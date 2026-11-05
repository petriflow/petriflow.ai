import {randomUUID} from "node:crypto";
import {generateAppManifest, type AppManifestMetadata} from "./app-manifest.service";
import {
  PACKAGE_LIMITS,
  PackageError,
  type ApplicationManifest,
  type ProcessXmlFile,
} from "./app-packaging.service";

/** A live packaging batch and the files accumulated for it. */
export interface PackageBatch {
  id: string;
  createdAt: number;
  updatedAt: number;
  manifest?: ApplicationManifest;
  metadata?: AppManifestMetadata;
  validationEnabled: boolean;
  processes: ProcessXmlFile[];
  processIds: Set<string>;
  fileNames: Set<string>;
  totalBytes: number;
}

/** Limits and clock/id overrides for a {@link PackageBatchStore}. */
export interface PackageBatchStoreOptions {
  ttlMs?: number;
  maxProcesses?: number;
  maxPackageBytes?: number;
  maxBatches?: number;
  maxRetainedBytes?: number;
  now?: () => number;
  createId?: () => string;
}

/** Initial manifest or metadata used when creating a batch. */
export interface PackageBatchCreateInput {
  manifest?: ApplicationManifest;
  metadata?: AppManifestMetadata;
  validationEnabled?: boolean;
}

/** Process-local batch storage. Batches are lost on restart and are not shared between replicas. */
export class PackageBatchStore {
  private readonly batches = new Map<string, PackageBatch>();
  private readonly ttlMs: number;
  private readonly maxProcesses: number;
  private readonly maxPackageBytes: number;
  private readonly maxBatches: number;
  private readonly maxRetainedBytes: number;
  private readonly now: () => number;
  private readonly createId: () => string;
  private retainedBytes = 0;

  /** Creates a store; omitted options fall back to {@link PACKAGE_LIMITS}. */
  constructor(options: PackageBatchStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? PACKAGE_LIMITS.batchTtlMs;
    this.maxProcesses = options.maxProcesses ?? PACKAGE_LIMITS.maxProcesses;
    this.maxPackageBytes = options.maxPackageBytes ?? PACKAGE_LIMITS.maxPackageBytes;
    this.maxBatches = options.maxBatches ?? PACKAGE_LIMITS.maxBatches;
    this.maxRetainedBytes = options.maxRetainedBytes ?? PACKAGE_LIMITS.maxRetainedBytes;
    this.now = options.now ?? Date.now;
    this.createId = options.createId ?? randomUUID;
  }

  /** Creates a batch and reserves the bytes of an uploaded manifest. */
  create(input: PackageBatchCreateInput): PackageBatch {
    this.sweep();
    if (this.batches.size >= this.maxBatches) {
      throw new PackageError("Too many open packaging batches; retry later", 503);
    }

    const manifestBytes = input.manifest?.content.length ?? 0;
    if (this.retainedBytes + manifestBytes > this.maxRetainedBytes) {
      throw new PackageError("Packaging storage is full; retry later", 503);
    }

    const now = this.now();
    const batch: PackageBatch = {
      id: this.createId(),
      createdAt: now,
      updatedAt: now,
      manifest: input.manifest,
      metadata: input.metadata,
      validationEnabled: input.validationEnabled ?? false,
      processes: [],
      processIds: new Set(),
      fileNames: new Set(),
      totalBytes: 0,
    };
    this.batches.set(batch.id, batch);
    this.retainedBytes += manifestBytes;
    return batch;
  }

  /** Returns a live batch, purging it first when its TTL elapsed. */
  get(id: string): PackageBatch | undefined {
    return this.live(id);
  }

  /** Refreshes a live batch's TTL without changing its contents. */
  touch(id: string): PackageBatch | undefined {
    const batch = this.live(id);
    if (batch) {
      batch.updatedAt = this.now();
    }
    return batch;
  }

  /**
   * Refreshes a batch that was checked live at the start of an upload, even if
   * the TTL elapsed while validation was running.
   */
  refresh(batch: PackageBatch): boolean {
    if (this.batches.get(batch.id) !== batch) {
      return false;
    }
    batch.updatedAt = this.now();
    return true;
  }

  /** Adds process files after duplicate, process-count, package-size, and storage checks. */
  addProcesses(id: string, files: ProcessXmlFile[]): PackageBatch {
    const batch = this.live(id);
    if (!batch) {
      throw new PackageError("Packaging batch not found or expired", 404);
    }

    const processIds = new Set(batch.processIds);
    const fileNames = new Set(batch.fileNames);
    let addedBytes = 0;

    for (const file of files) {
      if (processIds.has(file.id)) {
        throw new PackageError(`Duplicate process id: ${file.id}`, 409);
      }
      if (fileNames.has(file.name)) {
        throw new PackageError(`Duplicate process file name: ${file.name}`, 409);
      }
      processIds.add(file.id);
      fileNames.add(file.name);
      addedBytes += file.content.length;
    }

    if (batch.processes.length + files.length > this.maxProcesses) {
      throw new PackageError("Application package exceeds the process limit", 413);
    }
    if (this.projectedPackageBytes(batch, addedBytes, processIds) > this.maxPackageBytes) {
      throw new PackageError("Application package exceeds the size limit", 413);
    }
    this.sweep();
    if (this.retainedBytes + addedBytes > this.maxRetainedBytes) {
      throw new PackageError("Packaging storage is full; retry later", 503);
    }

    batch.processes.push(...files);
    batch.processIds = processIds;
    batch.fileNames = fileNames;
    batch.totalBytes += addedBytes;
    batch.updatedAt = this.now();
    this.retainedBytes += addedBytes;
    return batch;
  }

  /** Deletes a batch and releases its retained bytes. */
  delete(id: string): boolean {
    const batch = this.batches.get(id);
    if (!batch) {
      return false;
    }
    this.batches.delete(id);
    this.retainedBytes -= this.retained(batch);
    return !this.expired(batch);
  }

  /** Absolute expiry timestamp for a batch. */
  expiresAt(batch: PackageBatch): number {
    return batch.updatedAt + this.ttlMs;
  }

  /** Removes expired batches and returns how many were removed. */
  sweep(): number {
    let removed = 0;
    for (const [id, batch] of this.batches) {
      if (this.expired(batch)) {
        this.batches.delete(id);
        this.retainedBytes -= this.retained(batch);
        removed++;
      }
    }
    return removed;
  }

  /** Returns a live batch, removing it when its TTL elapsed. */
  private live(id: string): PackageBatch | undefined {
    const batch = this.batches.get(id);
    if (!batch) {
      return undefined;
    }
    if (this.expired(batch)) {
      this.batches.delete(id);
      this.retainedBytes -= this.retained(batch);
      return undefined;
    }
    return batch;
  }

  /** Bytes retained by a batch: process files plus an uploaded manifest. */
  private retained(batch: PackageBatch): number {
    return batch.totalBytes + (batch.manifest?.content.length ?? 0);
  }

  /** Total package bytes after adding files, including the manifest that will be emitted. */
  private projectedPackageBytes(batch: PackageBatch, addedBytes: number, processIds: Set<string>): number {
    if (batch.manifest) {
      return this.retained(batch) + addedBytes;
    }
    if (batch.metadata) {
      const manifestXml = generateAppManifest({...batch.metadata, processes: [...processIds]});
      return batch.totalBytes + addedBytes + Buffer.byteLength(manifestXml, "utf8");
    }
    return batch.totalBytes + addedBytes;
  }

  /** Whether a batch's TTL has elapsed. */
  private expired(batch: PackageBatch): boolean {
    return this.now() > this.expiresAt(batch);
  }
}
