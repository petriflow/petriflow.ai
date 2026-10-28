import {InferSchema} from "xmcp";
import {z} from "zod";
import petriflowDataService from "../../../../services/petriflow-data.service";
import versionCompletions from "../../../../services/version-completions.service";

export const schema = {
  version: z.string().describe("Petriflow language version"),
};

export const complete = versionCompletions;

export const metadata = {
  name: "petriflow-components",
  title: "Petriflow components",
  description: "List available Petriflow field components",
  mimeType: "application/json",
};

export default function listComponents({version}: InferSchema<typeof schema>): string {
  return JSON.stringify({components: petriflowDataService.listComponents(version)}, null, 2);
}
