import type {FastifyInstance, FastifyReply, FastifyRequest} from "fastify";
import fastifyMultipart from "@fastify/multipart";
import type {AppManifestMetadata} from "../services/app-manifest.service";
import {
  buildApplicationPackage,
  PACKAGE_LIMITS,
  PackageError,
  parseManifestXml,
  parseProcessXml,
  type ApplicationManifest,
  type ProcessXmlFile,
} from "../services/app-packaging.service";
import {PackageBatchStore, type PackageBatch} from "../services/package-batch.service";
import validationService, {type ValidationResult} from "../services/validation.service";
import petriflowVersionService from "../services/petriflow-version.service";

export interface ApplicationPackageRouteOptions {
  maxFileBytes?: number;
  maxPackageBytes?: number;
  maxProcesses?: number;
  maxFieldBytes?: number;
  maxBatches?: number;
  maxRetainedBytes?: number;
  sweepIntervalMs?: number;
  validateProcess?: (xml: string) => Promise<ValidationResult>;
}

interface UploadedFile {
  filename: string;
  content: Buffer;
}

interface UploadedForm {
  fields: Record<string, string>;
  files: UploadedFile[];
}

interface ResolvedSource {
  manifest?: ApplicationManifest;
  metadata?: AppManifestMetadata;
  processFiles: UploadedFile[];
}

const MANIFEST_FILENAME = "manifest.xml";

function isManifestFile(filename: string): boolean {
  const base = filename.replace(/\\/g, "/").split("/").pop() ?? "";
  return base.toLowerCase() === MANIFEST_FILENAME;
}

async function readForm(
  request: FastifyRequest,
  maxBytes: number,
  maxFieldBytes: number,
): Promise<UploadedForm> {
  const fields: Record<string, string> = {};
  const files: UploadedFile[] = [];
  let totalBytes = 0;

  for await (const part of request.parts()) {
    if (part.type === "file") {
      const content = await part.toBuffer();
      totalBytes += content.length;
      if (totalBytes > maxBytes) {
        throw new PackageError("Application package exceeds the size limit", 413);
      }
      files.push({filename: part.filename ?? "", content});
    } else {
      if (part.valueTruncated) {
        throw new PackageError(`Field ${part.fieldname} exceeds the ${maxFieldBytes}-byte limit`, 413);
      }
      fields[part.fieldname] = String(part.value);
    }
  }

  return {fields, files};
}

function requiredField(fields: Record<string, string>, name: string): string {
  const value = fields[name]?.trim();
  if (!value) {
    throw new PackageError(`Missing required field: ${name}`, 400);
  }
  return value;
}

function optionalField(fields: Record<string, string>, name: string): string | undefined {
  return fields[name]?.trim() || undefined;
}

function metadataFromFields(fields: Record<string, string>): AppManifestMetadata {
  return {
    appId: requiredField(fields, "appId"),
    name: requiredField(fields, "name"),
    version: requiredField(fields, "version"),
    description: optionalField(fields, "description"),
    author: optionalField(fields, "author"),
    title: optionalField(fields, "title"),
  };
}

function parseValidateFlag(fields: Record<string, string>): boolean {
  const value = fields.validate?.trim();
  if (!value) {
    return false;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new PackageError("validate must be true or false", 400);
}

function resolveSource(form: UploadedForm, allowProcesses: boolean): ResolvedSource {
  const manifests = form.files.filter(file => isManifestFile(file.filename));
  if (manifests.length > 1) {
    throw new PackageError("Only one manifest.xml may be uploaded", 400);
  }

  const processFiles = form.files.filter(file => !isManifestFile(file.filename));
  if (!allowProcesses && processFiles.length > 0) {
    throw new PackageError("Send process files to the batch processes endpoint", 400);
  }

  if (manifests.length === 1) {
    return {manifest: parseManifestXml(manifests[0].content), processFiles};
  }

  return {metadata: metadataFromFields(form.fields), processFiles};
}

function parseProcesses(files: UploadedFile[]): ProcessXmlFile[] {
  return files.map(file => parseProcessXml(file.filename, file.content));
}

function sendZip(reply: FastifyReply, archive: Buffer, appId?: string) {
  const name = appId?.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "application";
  return reply
    .type("application/zip")
    .header("Content-Disposition", `attachment; filename="${name}.zip"`)
    .send(archive);
}

function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof PackageError) {
    return reply.code(error.statusCode).send({
      status: error.statusCode === 404 ? "not_found" : "error",
      error: error.message,
    });
  }

  const statusCode = (error as { statusCode?: number })?.statusCode;
  if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500) {
    return reply.code(statusCode).send({
      status: "error",
      error: (error as Error).message,
    });
  }

  throw error;
}

function batchResponse(batch: PackageBatch, store: PackageBatchStore) {
  return {
    batchId: batch.id,
    processCount: batch.processes.length,
    validate: batch.validationEnabled,
    expiresAt: new Date(store.expiresAt(batch)).toISOString(),
  };
}

/** Registers the application packaging HTTP endpoints. Batches live in memory in this process. */
export function registerApplicationPackageRoutes(
  app: FastifyInstance,
  store?: PackageBatchStore,
  options: ApplicationPackageRouteOptions = {},
): void {
  const limits = {
    maxFileBytes: options.maxFileBytes ?? PACKAGE_LIMITS.maxFileBytes,
    maxProcesses: options.maxProcesses ?? PACKAGE_LIMITS.maxProcesses,
    maxPackageBytes: options.maxPackageBytes ?? PACKAGE_LIMITS.maxPackageBytes,
    maxFieldBytes: options.maxFieldBytes ?? PACKAGE_LIMITS.maxFieldBytes,
    maxBatches: options.maxBatches ?? PACKAGE_LIMITS.maxBatches,
    maxRetainedBytes: options.maxRetainedBytes ?? PACKAGE_LIMITS.maxRetainedBytes,
  };
  const batchStore = store ?? new PackageBatchStore({
    maxProcesses: limits.maxProcesses,
    maxPackageBytes: limits.maxPackageBytes,
    maxBatches: limits.maxBatches,
    maxRetainedBytes: limits.maxRetainedBytes,
  });
  const validateProcess = options.validateProcess ??
    ((xml: string) => validationService.validate(xml, petriflowVersionService.getLatestVersion()));

  app.register(fastifyMultipart, {
    limits: {
      fileSize: limits.maxFileBytes,
      files: limits.maxProcesses,
      fields: 10,
      fieldSize: limits.maxFieldBytes,
      parts: limits.maxProcesses + 10,
    },
  });

  const sweepIntervalMs = options.sweepIntervalMs ?? 60_000;
  if (sweepIntervalMs > 0) {
    const timer = setInterval(() => batchStore.sweep(), sweepIntervalMs);
    timer.unref();
    app.addHook("onClose", () => {
      clearInterval(timer);
    });
  }

  app.post("/applications/package", async (request, reply) => {
    try {
      const form = await readForm(request, limits.maxPackageBytes, limits.maxFieldBytes);
      if (form.fields.validate !== undefined) {
        throw new PackageError("validate is only supported for batches", 400);
      }

      const source = resolveSource(form, true);
      if (source.processFiles.length === 0) {
        throw new PackageError("At least one process XML file is required", 400);
      }

      const processes = parseProcesses(source.processFiles);
      const pkg = buildApplicationPackage({
        manifest: source.manifest,
        metadata: source.metadata,
        processes,
      }, {maxPackageBytes: limits.maxPackageBytes});
      return sendZip(reply, pkg.archive, source.metadata?.appId);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post("/applications/package/batches", async (request, reply) => {
    try {
      const form = await readForm(request, limits.maxPackageBytes, limits.maxFieldBytes);
      const source = resolveSource(form, false);
      const validationEnabled = parseValidateFlag(form.fields);
      const batch = batchStore.create({
        manifest: source.manifest,
        metadata: source.metadata,
        validationEnabled,
      });
      return reply.code(201).send(batchResponse(batch, batchStore));
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post("/applications/package/batches/:batchId/processes", async (request, reply) => {
    const {batchId} = request.params as { batchId: string };
    try {
      const batch = batchStore.touch(batchId);
      if (!batch) {
        throw new PackageError("Packaging batch not found or expired", 404);
      }

      const form = await readForm(request, limits.maxPackageBytes, limits.maxFieldBytes);
      if (form.files.some(file => isManifestFile(file.filename))) {
        throw new PackageError("Send the manifest when starting the batch", 400);
      }
      if (form.files.length === 0) {
        throw new PackageError("No XML files uploaded", 400);
      }

      const processes = parseProcesses(form.files);
      if (batch.validationEnabled) {
        const issues: Array<Record<string, unknown>> = [];
        let invalid = false;

        for (const process of processes) {
          let result: ValidationResult;
          try {
            result = await validateProcess(process.content.toString("utf8"));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new PackageError(`Process validation is unavailable for ${process.name}: ${message}`, 503);
          }

          if (!result.valid) {
            invalid = true;
          }
          for (const issue of result.issues) {
            issues.push({filename: process.name, id: process.id, ...issue});
          }
        }

        if (invalid) {
          return reply.code(422).send({status: "invalid", batchId, issues});
        }
      }

      if (!batchStore.refresh(batch)) {
        throw new PackageError("Packaging batch not found or expired", 404);
      }
      const updated = batchStore.addProcesses(batchId, processes);
      return reply.send(batchResponse(updated, batchStore));
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post("/applications/package/batches/:batchId/complete", async (request, reply) => {
    const {batchId} = request.params as { batchId: string };
    try {
      const batch = batchStore.get(batchId);
      if (!batch) {
        throw new PackageError("Packaging batch not found or expired", 404);
      }

      const pkg = buildApplicationPackage({
        manifest: batch.manifest,
        metadata: batch.metadata,
        processes: batch.processes,
      }, {maxPackageBytes: limits.maxPackageBytes});
      batchStore.delete(batchId);
      return sendZip(reply, pkg.archive, batch.metadata?.appId);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.delete("/applications/package/batches/:batchId", async (request, reply) => {
    const {batchId} = request.params as { batchId: string };
    if (!batchStore.delete(batchId)) {
      return reply.code(404).send({
        status: "not_found",
        error: "Packaging batch not found or expired",
      });
    }
    return reply.code(204).send();
  });
}
