import {InferSchema} from "xmcp";
import {z} from "zod";
import petriflowDataService from "../../../../services/petriflow-data.service";
import versionCompletions from "../../../../services/version-completions.service";

export const schema = {
  version: z.string().describe("Petriflow language version"),
};

export const complete = versionCompletions;

export const metadata = {
  name: "petriflow-actions",
  title: "Petriflow actions",
  description: "List available Petriflow action definitions",
  mimeType: "application/json",
};

export default function listActions({version}: InferSchema<typeof schema>): string {
  return JSON.stringify({actions: petriflowDataService.listActions(version)}, null, 2);
}
