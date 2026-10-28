import {InferSchema} from "xmcp";
import {z} from "zod";
import petriflowDataService from "../../../../../../services/petriflow-data.service";
import versionCompletions from "../../../../../../services/version-completions.service";

export const schema = {
  version: z.string().describe("Petriflow language version"),
  component: z.string().describe("Identifier of the component definition"),
};

export const complete = versionCompletions;

export const metadata = {
  name: "petriflow-component",
  title: "Petriflow component definition",
  description: "Get the complete definition of a Petriflow field component",
  mimeType: "application/json",
};

export default function getComponent({version, component}: InferSchema<typeof schema>): string {
  return JSON.stringify({component: petriflowDataService.getComponent(version, component)}, null, 2);
}
