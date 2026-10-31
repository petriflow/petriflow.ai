import {z} from "zod";
import {InferSchema} from "xmcp";
import petriflowDataService from "../services/petriflow-data.service";
import {withToolFeatureFlag} from "../services/feature-flags.service";

export const schema = {
  version: z.string().describe("Version of the schema"),
  name: z.string().describe("Name of the element"),
};

export const metadata = withToolFeatureFlag({
  name: "get_element",
  description: "Get the XSD schema of a Petriflow element",
  annotation: {
    title: "Get the XSD schema of a Petriflow element",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
});

export default async function getElement({version, name}: InferSchema<typeof schema>) {
  return petriflowDataService.getElement(version, name);
}
