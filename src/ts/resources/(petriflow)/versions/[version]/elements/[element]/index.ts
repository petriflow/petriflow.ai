import {InferSchema} from "xmcp";
import {z} from "zod";
import petriflowDataService from "../../../../../../services/petriflow-data.service";
import versionCompletions from "../../../../../../services/version-completions.service";

export const schema = {
  version: z.string().describe("Petriflow language version"),
  element: z.string().describe("Name of the element"),
};

export const complete = versionCompletions;

export const metadata = {
  name: "petriflow-element",
  title: "Petriflow element XSD",
  description: "Get the XSD definition of a Petriflow element",
  mimeType: "application/xml",
};

export default function getElement({version, element}: InferSchema<typeof schema>): string {
  return petriflowDataService.getElement(version, element);
}
