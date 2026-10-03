import path from "node:path";
import * as fs from "node:fs";
import {z} from "zod";
import {InferSchema} from "xmcp";
import {getLatestVersion, getVersionedPath} from "../services/utils";
import {logger} from "../services/logger.service";


const EXAMPLES_FOLDER = 'examples';

export const schema = {
  version: z.string().describe("Version of the schema"),
};

export const outputSchema = {
  examples: z.array(z.object({
    name: z.string().describe("Name of the example"),
    description: z.string().describe("Description of the example"),
  })).describe("List of examples"),
};

export const metadata = {
  name: "list-examples",
  description: "List all examples in Petriflow language",
  annotation: {
    title: "List examples of Petriflow language",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export default async function listExamples({version}: InferSchema<typeof schema>) {
  if (version === "latest") {
    version = getLatestVersion();
    logger.info(`Using cached latest version: ${version}`);
  }

  const examplesFiles = getVersionedPath(version, [EXAMPLES_FOLDER]);
  const examples = fs.readdirSync(examplesFiles)
    .filter(file => file.endsWith(".xml"))
    .map(f => extractExample(examplesFiles, f))
    .sort((a, b) => a.name.localeCompare(b.name));

  logger.info(`Listed ${examples.length} Petriflow examples`);
  return {structuredContent: {examples}};
}

function extractExample(folder: string, file: string) {
  const content = fs.readFileSync(path.join(folder, file), {encoding: "utf-8"});
  const title = new RegExp(/<\s*title\b[^>]*>([\s\S]*?)<\s*\/\s*title\s*>/i).exec(content)?.[1]?.trim() ?? "";

  return {
    name: path.basename(file, ".xml"),
    description: title
  };
}
