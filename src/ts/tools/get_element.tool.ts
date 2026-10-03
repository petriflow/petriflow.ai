import {z} from "zod";
import {InferSchema} from "xmcp";
import {getLatestVersion, getVersionedPath} from "../services/utils";
import {logger} from "../services/logger.service";
import fs from "node:fs";


const ELEMENTS_FOLDER = "elements";

export const schema = {
  version: z.string().describe("Version of the schema"),
  name: z.string().describe("Name of the element"),
};

export const metadata = {
  name: "get-element",
  description: "Get the XSD schema of a Petriflow element",
  annotation: {
    title: "Get the XSD schema of a Petriflow element",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export default async function getElement({version, name}: InferSchema<typeof schema>) {
  if (version === "latest") {
    version = getLatestVersion();
    logger.info(`Using cached latest version: ${version}`);
  }

  const elementFile = getVersionedPath(version, [ELEMENTS_FOLDER, name + ".xsd"]);

  return fs.promises.readFile(elementFile, {encoding: "utf-8"});
}
