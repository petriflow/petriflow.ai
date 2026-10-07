import {InferSchema} from "xmcp";
import {z} from "zod";
import petriflowDataService from "../../../../services/petriflow-data.service";
import versionCompletions from "../../../../services/version-completions.service";

export const schema = {
  version: z.string().describe("Petriflow language version"),
};

export const complete = versionCompletions;

export const metadata = {
  name: "petriflow-examples",
  title: "Petriflow examples",
  description: "List available Petriflow process examples",
  mimeType: "application/json",
};

export default function listExamples({version}: InferSchema<typeof schema>): string {
  return JSON.stringify({examples: petriflowDataService.listExamples(version)}, null, 2);
}
