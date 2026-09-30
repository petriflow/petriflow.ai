import {z} from "zod";
import {getLatestVersion, getVersionedPath} from "../services/utils";
import {logger} from "../services/logger.service";
import {InferSchema} from "xmcp";
import fs from "node:fs";


const OVERVIEW_FILE = 'overview.md';

export const schema = {
  version: z.string().describe("Version of the schema"),
};

export const metadata = {
  name: "get-overview",
  description: "Show overview of Petriflow language",
  annotation: {
    title: "Overview of Petriflow language",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export default async function getOverview({version}: InferSchema<typeof schema>) {
  if (version === "latest") {
    version = getLatestVersion();
    logger.info(`Using cached latest version: ${version}`);
  }

  const overviewFilePath = getVersionedPath(version, [OVERVIEW_FILE]);

  return fs.promises.readFile(overviewFilePath, {encoding: "utf-8"});
}
