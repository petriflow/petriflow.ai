import cache from "./cache.service";
import {logger} from "./logger.service";

const PETRIFLOW_URL = "https://github.com/petriflow/petriflow/raw/refs/heads/main/docs/v{VERSION}/petriflow.schema.xsd";
const SCHEMA_CACHE_KEY = "petriflow.schema.v{VERSION}.xsd";

/**
 * Resolves and returns the Petriflow XSD schema content for the given version.
 *
 * The schema is cached on disk keyed by version. Cached versions are read directly;
 * on a cache miss the schema is fetched from the Petriflow repository and persisted
 * before being returned.
 *
 * @param version the Petriflow language version (a concrete version, not "latest")
 * @returns the XSD schema as a string
 */
export async function getSchemaXsd(version: string): Promise<string> {
  const cacheKey = SCHEMA_CACHE_KEY.replace("{VERSION}", version);

  const cached = cache.file(cacheKey);
  if (cached) {
    logger.info(`Schema found in cache: ${cacheKey}`);
    return cached;
  }

  const url = PETRIFLOW_URL.replace("{VERSION}", version);
  logger.info(`Fetching XSD schema from ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch XSD schema: ${response.status} ${response.statusText}`);
  }

  const xsd = await response.text();
  cache.write(cacheKey, xsd);
  logger.info(`Schema fetched and cached: ${cacheKey}`);
  return xsd;
}