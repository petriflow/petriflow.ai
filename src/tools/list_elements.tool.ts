import path from "node:path";
import * as fs from "node:fs";
import {z} from "zod";
import {InferSchema} from "xmcp";
import {getLatestVersion, getVersionedPath} from "../services/utils";
import {logger} from "../services/logger.service";


const ELEMENTS_FOLDER = "elements";

const ELEMENT_DESCRIPTIONS: Record<string, string> = {
  transaction: "Transaction definition",
  data: "Data field definition",
  function: "Function definition",
  role: "Role definition",
  mapping: "Mapping definition",
  transition: "Transition definition",
  place: "Place definition",
  arc: "Arc definition",
  i18n: "Internationalization strings",
  processEvents: "Process events",
  caseEvents: "Case events",
  document: "Root document element",
};

export const schema = {
  version: z.string().describe("Version of the schema"),
};

export const outputSchema = {
  elements: z.array(z.object({
    name: z.string().describe("Name of the element"),
    description: z.string().describe("Description of the element"),
  })).describe("List of elements"),
};

export const metadata = {
  name: "list-elements",
  description: "List all elements of Petriflow language",
  annotation: {
    title: "List elements of Petriflow language",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export default async function listElements({version}: InferSchema<typeof schema>) {
  if (version === "latest") {
    version = getLatestVersion();
    logger.info(`Using cached latest version: ${version}`);
  }

  const elementsFolder = getVersionedPath(version, [ELEMENTS_FOLDER]);
  const elements = fs.readdirSync(elementsFolder)
    .filter(file => file.endsWith(".xsd"))
    .map(file => {
      const name = path.basename(file, ".xsd");
      return {
        name,
        description: ELEMENT_DESCRIPTIONS[name] ?? ""
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  logger.info(`Listed ${elements.length} Petriflow elements`);
  return {structuredContent: {elements}};
}
