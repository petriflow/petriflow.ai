import fs from "node:fs";
import path from "node:path";
import {valid as isValidVersion} from "semver";
import storage, {StorageService} from "./storage.service";
import {validateReleaseFiles} from "./release-files.service";

export interface SnapshotManifest {
  version: string;
  releaseDate: string;
}

export class PetriflowSnapshotService {
  constructor(
    private readonly snapshotPath = path.join(__dirname, "petriflow", "snapshot"),
    private readonly fileStorage: StorageService = storage,
  ) {}

  /** Validates and atomically installs the checked-in latest release snapshot. */
  install(): SnapshotManifest {
    if (!fs.existsSync(this.snapshotPath) || !fs.statSync(this.snapshotPath).isDirectory()) {
      throw new Error(`Petriflow snapshot directory not found: ${this.snapshotPath}`);
    }

    const manifestPath = path.join(this.snapshotPath, "manifest.json");
    if (!fs.existsSync(manifestPath) || !fs.statSync(manifestPath).isFile()) {
      throw new Error("Petriflow snapshot manifest.json not found");
    }

    const manifest = this.readManifest(manifestPath);
    const files = this.readSnapshotFiles();
    validateReleaseFiles(files, "Petriflow snapshot");
    this.fileStorage.installVersion(manifest.version, files);
    return manifest;
  }

  private readManifest(manifestPath: string): SnapshotManifest {
    let value: unknown;
    try {
      value = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid Petriflow snapshot manifest: ${message}`);
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Invalid Petriflow snapshot manifest: expected an object");
    }
    const manifest = value as Partial<SnapshotManifest>;
    if (typeof manifest.version !== "string" || !isValidVersion(manifest.version)) {
      throw new Error("Invalid Petriflow snapshot manifest: version must be a valid SemVer");
    }
    if (manifest.releaseDate !== undefined &&
      (typeof manifest.releaseDate !== "string" ||
        (manifest.releaseDate !== "" && !Number.isFinite(Date.parse(manifest.releaseDate))))) {
      throw new Error("Invalid Petriflow snapshot manifest: releaseDate must be a valid date or empty");
    }
    return {version: manifest.version, releaseDate: manifest.releaseDate ?? ""};
  }

  private readSnapshotFiles(): Record<string, string> {
    const files = Object.create(null) as Record<string, string>;
    const decoder = new TextDecoder("utf-8", {fatal: true});

    const visit = (directory: string): void => {
      for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
        const absolutePath = path.join(directory, entry.name);
        const relativePath = path.relative(this.snapshotPath, absolutePath).split(path.sep).join("/");
        if (entry.isSymbolicLink()) {
          throw new Error(`Unsafe symbolic link in Petriflow snapshot: ${relativePath}`);
        }
        if (entry.isDirectory()) {
          visit(absolutePath);
          continue;
        }
        if (!entry.isFile()) {
          throw new Error(`Unsupported entry in Petriflow snapshot: ${relativePath}`);
        }
        if (relativePath === "manifest.json") continue;
        files[relativePath] = decoder.decode(fs.readFileSync(absolutePath));
      }
    };

    visit(this.snapshotPath);
    return files;
  }
}

const petriflowSnapshotService = new PetriflowSnapshotService();
export default petriflowSnapshotService;
