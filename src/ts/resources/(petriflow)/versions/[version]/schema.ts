import {InferSchema} from "xmcp";
import {z} from "zod";
import petriflowDataService from "../../../../services/petriflow-data.service";
import versionCompletions from "../../../../services/version-completions.service";

export const schema = {
  version: z.string().describe("Petriflow language version"),
};

export const complete = versionCompletions;

export const metadata = {
  name: "petriflow-schema",
  title: "Petriflow XSD schema",
  description: "Get the complete XSD schema for a Petriflow release",
  mimeType: "application/xml",
};

export default function getSchema({version}: InferSchema<typeof schema>): string {
  return petriflowDataService.getSchemaXsd(version);
}
