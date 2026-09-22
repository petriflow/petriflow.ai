import path from "node:path";
import * as fs from "node:fs";


const FILE_CACHE = path.join(__dirname, "cache.d");
const DATA_CACHE = path.join(__dirname, "cache.json");

/**
 * Service that provides a simple persistent key-value cache backed by files on disk.
 *
 * Data entries are stored as JSON in a single file ({@link DATA_CACHE}), while larger
 * or file-oriented values can be stored as individual files under {@link FILE_CACHE}.
 */
export class CacheService {

  private readonly _cache: { [key: string]: any };

  constructor() {
    this._cache = {};
    if (fs.existsSync(DATA_CACHE)) {
      this._cache = JSON.parse(fs.readFileSync(DATA_CACHE, "utf-8"));
    }
  }

  /**
   * Returns a summary of the current cache state.
   *
   * @returns an object containing the number of data entries, the number of cached files
   * and the list of data keys currently present in the cache
   */
  status() {
    return {
      dataCount: Object.keys(this._cache).length,
      fileCount: fs.existsSync(FILE_CACHE) ? fs.readdirSync(FILE_CACHE).length : 0,
      dataKeys: Object.keys(this._cache)
    };
  }

  /**
   * Retrieves a data entry stored under the given key.
   *
   * @param key the cache key to look up
   * @returns the stored value, or {@code undefined} if no entry exists for the key
   */
  get(key: string): any {
    return this._cache[key];
  }

  /**
   * Stores a value under the given key, persisting the cache to disk.
   *
   * @param key the cache key under which the value is stored
   * @param value the value to store
   */
  set(key: string, value: any): void {
    this._cache[key] = value;
    fs.writeFileSync(DATA_CACHE, JSON.stringify(this._cache));
  }

  /**
   * Removes the data entry stored under the given key, persisting the cache to disk.
   *
   * @param key the cache key whose entry should be removed
   */
  delete(key: string): void {
    delete this._cache[key];
    fs.writeFileSync(DATA_CACHE, JSON.stringify(this._cache));
  }

  /**
   * Reads the contents of a cached file with the given key.
   *
   * @param key the file key to look up
   * @returns the file contents as a string, or {@code undefined} if no such file exists
   */
  file(key: string): string | undefined {
    if (!fs.existsSync(path.join(FILE_CACHE, key)))
      return undefined;
    return fs.readFileSync(path.join(FILE_CACHE, key), "utf-8");
  }

  /**
   * Writes a file with the given key, creating the cache directory if necessary.
   *
   * @param key the file key under which the value is stored
   * @param value the contents to write to the file
   */
  write(key: string, value: string): void {
    if (!fs.existsSync(FILE_CACHE)) {
      fs.mkdirSync(FILE_CACHE, {recursive: true});
    }
    fs.writeFileSync(path.join(FILE_CACHE, key), value);
  }

}

const cache = new CacheService();
export default cache;
