import {z} from "zod";
import {InferSchema} from "xmcp";
import cache from "../services/cache.service";
import {logger} from "../services/logger.service";
import {getLatestVersion} from "../services/utils";

const PETRIFLOW_URL = "https://github.com/petriflow/petriflow/raw/refs/heads/main/docs/v{VERSION}/petriflow.schema.xsd"
const SCHEMA_CACHE_KEY = "petriflow.schema.v{VERSION}.xsd"

export const schema = {
  version: z.string().describe("Version of the schema"),
};

export const metadata = {
  name: "get-schema",
  description: "Get complete XSD schema of Petriflow language",
  annotation: {
    title: "Get XSD schema of Petriflow language",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

export default async function getSchema({version}: InferSchema<typeof schema>) {
  if (version === "latest") {
    version = getLatestVersion();
    logger.info(`Using cached latest version: ${version}`);
  }

  const cacheKey = SCHEMA_CACHE_KEY.replace("{VERSION}", version);
  let xsd = cache.file(cacheKey);
  if (xsd) {
    logger.info(`Schema found in cache: ${cacheKey}`);
    return xsd;
  }

  const url = PETRIFLOW_URL.replace("{VERSION}", version);
  logger.info(`Fetching XSD schema from ${url}`);
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to fetch XSD schema: ${response.status} ${response.statusText}`)

  xsd = await response.text();
  cache.write(cacheKey, xsd);
  logger.info(`Schema fetched and cached: ${cacheKey}`);
  return xsd;
}


