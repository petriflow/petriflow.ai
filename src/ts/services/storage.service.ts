import path from "node:path";
import fs from "node:fs";

export enum FileType {
  SCHEMA = "schemas",
  ELEMENT = "elements",
  EXAMPLE = "examples"
}

export class StorageService {

  static readonly STORAGE_PATH = path.join(__dirname, 'storage');

  constructor() {
    if (!fs.existsSync(StorageService.STORAGE_PATH)) {
      fs.mkdirSync(StorageService.STORAGE_PATH, {recursive: true});
    }
  }

  /**
   * Reads the content of a file from the specified storage path.
   *
   * @param {string} name - The name of the file to read.
   * @param {FileType} type - The type or category of the file, used to determine its directory path.
   * @return {string | undefined} - Returns the content of the file as a string if it exists, or undefined if the file does not exist.
   */
  read(name: string, type: FileType): string | undefined {
    const filePath = path.join(StorageService.STORAGE_PATH, type as string, name);
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
    const filePath = path.join(StorageService.STORAGE_PATH, type as string, name);
    if (!fs.existsSync(path.join(StorageService.STORAGE_PATH, type as string))) {
      fs.mkdirSync(path.join(StorageService.STORAGE_PATH, type as string), {recursive: true});
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
    const filePath = path.join(StorageService.STORAGE_PATH, type as string, name);
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
