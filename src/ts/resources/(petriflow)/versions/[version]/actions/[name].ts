import {InferSchema} from "xmcp";
import {z} from "zod";
import petriflowDataService from "../../../../../services/petriflow-data.service";
import versionCompletions from "../../../../../services/version-completions.service";

export const schema = {
  version: z.string().describe("Petriflow language version"),
  name: z.string().describe("Name of the action"),
};

export const complete = versionCompletions;

export const metadata = {
  name: "petriflow-action",
  title: "Petriflow action definition",
  description: "Get the complete definition of a Petriflow action",
  mimeType: "application/json",
};

export default function getAction({version, name}: InferSchema<typeof schema>): string {
  return JSON.stringify({action: petriflowDataService.getAction(version, name)}, null, 2);
}
