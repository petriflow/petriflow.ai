import path from "node:path";
import fs from "node:fs";
import {randomUUID} from "node:crypto";
import {valid as isValidVersion} from "semver";
import {getSingleton} from "./singleton-registry.service";

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


  /** Lists absolute paths of the direct entries in a version subdirectory. */
  listVersionFiles(version: string, childDirectory: string): string[] {
    const directoryPath = this.getVersionFilePath(version, childDirectory);
    if (!this.hasVersion(version) || !fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
      return [];
    }
    return fs.readdirSync(directoryPath, {withFileTypes: true})
      .map((entry) => path.join(directoryPath, entry.name))
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

  /** Atomically installs files by copying them from a source directory without decoding their contents. */
  installVersionFromDirectory(version: string, sourceDirectory: string, relativePaths: string[]): boolean {
    const targetPath = this.getVersionPath(version);
    if (fs.existsSync(targetPath)) {
      if (this.hasVersion(version)) return false;
      throw new Error(`Incomplete release directory exists for ${version}`);
    }

    const sourceRoot = path.resolve(sourceDirectory);
    if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
      throw new Error(`Release source directory not found: ${sourceDirectory}`);
    }

    const temporaryPath = fs.mkdtempSync(path.join(this.storagePath, `.tmp-${version}-${randomUUID()}-`));
    try {
      for (const relativePath of relativePaths) {
        if (relativePath === ".complete") {
          throw new Error("Release file path is reserved");
        }

        const sourceFile = this.getVersionFilePath(version, relativePath, sourceRoot);
        const sourceStat = fs.lstatSync(sourceFile);
        if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
          throw new Error(`Release source path is not a regular file: ${relativePath}`);
        }

        const destination = this.getVersionFilePath(version, relativePath, temporaryPath);
        fs.mkdirSync(path.dirname(destination), {recursive: true});
        fs.copyFileSync(sourceFile, destination, fs.constants.COPYFILE_EXCL);
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

  /**
   * Resolves the absolute file path for a specific version and relative path.
   * Ensures the relative path is valid and does not escape the intended root directory for the version.
   *
   * @param {string} version - The version identifier for which to resolve the file path.
   * @param {string} relativePath - The relative file path to be resolved within the version's directory.
   * @param {string} [root=this.getVersionPath(version)] - The root directory for the specified version. Defaults to the output of the `getVersionPath` method.
   * @return {string} The resolved absolute file path for the given version and relative path.
   * @throws {Error} If the `relativePath` is invalid, empty, absolute, or escapes the intended root directory.
   */
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

const storage = getSingleton("netgrif.petriflow.ai/storage", () => new StorageService());
export default storage;
