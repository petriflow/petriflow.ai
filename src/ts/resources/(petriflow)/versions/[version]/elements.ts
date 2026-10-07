import {InferSchema} from "xmcp";
import {z} from "zod";
import petriflowDataService from "../../../../services/petriflow-data.service";
import versionCompletions from "../../../../services/version-completions.service";

export const schema = {
  version: z.string().describe("Petriflow language version"),
};

export const complete = versionCompletions;

export const metadata = {
  name: "petriflow-elements",
  title: "Petriflow elements",
  description: "List Petriflow language elements",
  mimeType: "application/json",
};

export default function listElements({version}: InferSchema<typeof schema>): string {
  return JSON.stringify({elements: petriflowDataService.listElements(version)}, null, 2);
}
