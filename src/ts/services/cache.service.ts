import path from "node:path";
import * as fs from "node:fs";
import {getSingleton} from "./singleton-registry.service";


const DATA_CACHE = path.join(__dirname, "cache.json");

/**
 * Service that provides a simple persistent key-value cache backed by files on disk.
 *
 * Data entries are stored as JSON in a single file ({@link DATA_CACHE}), while larger
 * or file-oriented values can be stored as individual files under {@link FILE_CACHE}.
 */
export class CacheService {

  private readonly _cache: { [key: string]: any };
  private readonly cacheFile: string;

  constructor(cacheFile = DATA_CACHE) {
    this.cacheFile = cacheFile;
    this._cache = {};
    if (fs.existsSync(this.cacheFile)) {
      this._cache = JSON.parse(fs.readFileSync(this.cacheFile, "utf-8"));
    }
  }

  /**
   * Returns a summary of the current cache state.
   *
   * @returns an object containing the number of data entries and the list of data keys currently present in the cache
   */
  status() {
    return {
      dataCount: Object.keys(this._cache).length,
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
    fs.writeFileSync(this.cacheFile, JSON.stringify(this._cache));
  }

  /**
   * Removes the data entry stored under the given key, persisting the cache to disk.
   *
   * @param key the cache key whose entry should be removed
   */
  delete(key: string): void {
    delete this._cache[key];
    fs.writeFileSync(this.cacheFile, JSON.stringify(this._cache));
  }

}

const cache = getSingleton("netgrif.petriflow.ai/cache", () => new CacheService());
export default cache;
