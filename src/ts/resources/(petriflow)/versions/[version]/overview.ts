import {InferSchema} from "xmcp";
import {getLatestVersion, getVersionedPath} from "../../../../services/utils";
import {logger} from "../../../../services/logger.service";
import fs from "node:fs";
import {z} from "zod";


const OVERVIEW_FILE = 'overview.md';

export const schema = {
  version: z.string().describe("Version of the schema"),
};

export const metadata = {
  name: "overview",
  title: "Petriflow Overview",
  description: "Show overview of Petriflow language"
};

export default function getOverview({version}: InferSchema<typeof schema>) {
  if (version === "latest") {
    version = getLatestVersion();
    logger.info(`Using cached latest version: ${version}`);
  }

  const overviewFilePath = getVersionedPath(version, [OVERVIEW_FILE]);

  return fs.readFileSync(overviewFilePath, {encoding: "utf-8"});
}
