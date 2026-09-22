import path from "node:path";
import * as fs from "node:fs";
import {z} from "zod";
import {InferSchema} from "xmcp";
import {getLatestVersion} from "../services/cache.service";
import {logger} from "../services/logger.service";


const EXAMPLES_FOLDER = path.join(__dirname, 'public', 'examples');

export const schema = {
  version: z.string().describe("Version of the schema"),
};

export const outputSchema = {
  examples: z.array(z.object({
    name: z.string().describe("Name of the example"),
    description: z.string().describe("Description of the example"),
  })).describe("List of examples"),
}

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

  if (!fs.existsSync(EXAMPLES_FOLDER)) {
    throw new Error(`Examples folder not found: ${EXAMPLES_FOLDER}`);
  }

  const examples = fs.readdirSync(EXAMPLES_FOLDER)
    .filter(file => file.endsWith(".xml"))
    .map(extractExample)
    .sort((a, b) => a.name.localeCompare(b.name));

  logger.info(`Listed ${examples.length} Petriflow examples`);
  return {examples};
}

function extractExample(file: string) {
  const content = fs.readFileSync(path.join(EXAMPLES_FOLDER, file), "utf-8");
  const title = new RegExp(/<\s*title\b[^>]*>([\s\S]*?)<\s*\/\s*title\s*>/i).exec(content)?.[1]?.trim() ?? "";

  return {
    name: path.basename(file, ".xml"),
    description: title
  };
}
