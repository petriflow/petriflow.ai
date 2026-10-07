import path from "node:path";
import fs from "node:fs";
import {randomUUID} from "node:crypto";
import {valid as isValidVersion} from "semver";

export enum FileType {
  SCHEMA = "schemas",
  ELEMENT = "elements",
  EXAMPLE = "examples"
}

export class StorageService {

  static readonly STORAGE_PATH = path.join(__dirname, 'storage');
  readonly storagePath: string;

  constructor(storagePath = StorageService.STORAGE_PATH) {
    this.storagePath = storagePath;
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, {recursive: true});
    }
  }

  /** Returns the versions that have been fully installed in storage. */
  listInstalledVersions(): string[] {
    return fs.readdirSync(this.storagePath, {withFileTypes: true})
      .filter((entry) => entry.isDirectory() && isValidVersion(entry.name) !== null && this.hasVersion(entry.name))
      .map((entry) => entry.name)
      .sort();
  }

  /** Returns whether a complete release directory exists. */
  hasVersion(version: string): boolean {
    const versionPath = this.getVersionPath(version);
    return fs.existsSync(path.join(versionPath, ".complete"));
  }

  /** Reads a file from a fully installed release. */
  readVersionFile(version: string, relativePath: string): string | undefined {
    const filePath = this.getVersionFilePath(version, relativePath);
    if (!this.hasVersion(version) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return undefined;
    }
    return fs.readFileSync(filePath, "utf-8");
  }

  /** Lists direct file entries inside a directory of an installed release. */
  listVersionFiles(version: string, relativeDirectory: string): string[] {
    const directoryPath = this.getVersionFilePath(version, relativeDirectory);
    if (!this.hasVersion(version) || !fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
      return [];
    }
    return fs.readdirSync(directoryPath, {withFileTypes: true})
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  }

  /**
   * Installs release files as a single directory rename. Existing versions are
   * immutable and are never overwritten.
   *
   * @returns false when the version already exists, true when installed
   */
  installVersion(version: string, files: Record<string, string>): boolean {
    const targetPath = this.getVersionPath(version);
    if (fs.existsSync(targetPath)) {
      if (this.hasVersion(version)) return false;
      throw new Error(`Incomplete release directory exists for ${version}`);
    }

    const temporaryPath = fs.mkdtempSync(path.join(this.storagePath, `.tmp-${version}-${randomUUID()}-`));
    try {
      for (const [relativePath, content] of Object.entries(files)) {
        if (relativePath === ".complete") {
          throw new Error("Release file path is reserved");
        }
        const destination = this.getVersionFilePath(version, relativePath, temporaryPath);
        fs.mkdirSync(path.dirname(destination), {recursive: true});
        fs.writeFileSync(destination, content, {encoding: "utf-8", flag: "wx"});
      }

      fs.writeFileSync(path.join(temporaryPath, ".complete"), version, {encoding: "utf-8", flag: "wx"});
      fs.renameSync(temporaryPath, targetPath);
      return true;
    } catch (error) {
      fs.rmSync(temporaryPath, {recursive: true, force: true});
      if (fs.existsSync(targetPath) && this.hasVersion(version)) {
        return false;
      }
      throw error;
    }
  }

  private getVersionPath(version: string): string {
    if (!isValidVersion(version)) {
      throw new Error(`Invalid release version: ${version}`);
    }
    return path.join(this.storagePath, version);
  }

  private getVersionFilePath(version: string, relativePath: string, root = this.getVersionPath(version)): string {
    const segments = relativePath.split(/[\\/]/);
    if (!relativePath || path.posix.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath) ||
      segments.some((segment) => segment === ".." || segment === "")) {
      throw new Error(`Invalid release file path: ${relativePath}`);
    }

    const resolved = path.resolve(root, ...segments);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new Error(`Invalid release file path: ${relativePath}`);
    }
    return resolved;
  }

  /**
   * Reads the content of a file from the specified storage path.
   *
   * @param {string} name - The name of the file to read.
   * @param {FileType} type - The type or category of the file, used to determine its directory path.
   * @return {string | undefined} - Returns the content of the file as a string if it exists, or undefined if the file does not exist.
   */
  read(name: string, type: FileType): string | undefined {
    const filePath = path.join(this.storagePath, type as string, name);
    if (!fs.existsSync(filePath))
      return undefined;
    return fs.readFileSync(filePath, "utf-8");
  }

  /**
   * Writes a file with the specified name, type, and value to the storage path.
   *
   * @param {string} name - The name of the file to write.
   * @param {FileType} type - The type or category of the file, used to determine its directory.
   * @param {string} value - The content to write into the file.
   * @return {boolean} True if the file is successfully written and exists, false otherwise.
   */
  write(name: string, type: FileType, value: string): boolean {
    const filePath = path.join(this.storagePath, type as string, name);
    if (!fs.existsSync(path.join(this.storagePath, type as string))) {
      fs.mkdirSync(path.join(this.storagePath, type as string), {recursive: true});
    }
    fs.writeFileSync(filePath, value);
    return fs.existsSync(filePath);
  }

  /**
   * Deletes a file from the storage based on the provided name and file type.
   *
   * @param {string} name - The name of the file to be deleted.
   * @param {FileType} type - The type/category of the file to locate it in the storage.
   * @return {boolean} Returns true if the file was successfully deleted, false otherwise.
   */
  delete(name: string, type: FileType): boolean {
    const filePath = path.join(this.storagePath, type as string, name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    } else {
      return false;
    }
    return !fs.existsSync(filePath);
  }

}

const storage = new StorageService();
export default storage;
