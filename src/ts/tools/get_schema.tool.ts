import {z} from "zod";
import {InferSchema} from "xmcp";
import petriflowDataService from "../services/petriflow-data.service";
import {withToolFeatureFlag} from "../services/feature-flags.service";

export const schema = {
  version: z.string().describe("Version of the schema"),
};

export const metadata = withToolFeatureFlag({
  name: "get_schema",
  description: "Get complete XSD schema of Petriflow language",
  annotation: {
    title: "Get XSD schema of Petriflow language",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
});

export default async function getSchema({version}: InferSchema<typeof schema>) {
  return petriflowDataService.getSchemaXsd(version);
}
