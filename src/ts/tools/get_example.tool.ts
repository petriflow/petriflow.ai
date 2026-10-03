import {z} from "zod";
import {InferSchema} from "xmcp";
import {getLatestVersion, getVersionedPath} from "../services/utils";
import {logger} from "../services/logger.service";
import fs from "node:fs";


const EXAMPLES_FOLDER = "examples";

export const schema = {
  version: z.string().describe("Version of the example"),
  example: z.string().describe("Name of the example"),
};

export const metadata = {
  name: "get-example",
  description: "Get the content of an example process",
  annotation: {
    title: "Get the content of an example process",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export default async function getExample({version, example}: InferSchema<typeof schema>) {
  if (version === "latest") {
    version = getLatestVersion();
    logger.info(`Using cached latest version: ${version}`);
  }

  const exampleFile = getVersionedPath(version, [EXAMPLES_FOLDER, example + ".xml"])

  return fs.promises.readFile(exampleFile, {encoding: "utf-8"});
}
