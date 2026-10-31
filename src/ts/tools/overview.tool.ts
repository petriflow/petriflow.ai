import {z} from "zod";
import {InferSchema} from "xmcp";
import petriflowDataService from "../services/petriflow-data.service";
import {withToolFeatureFlag} from "../services/feature-flags.service";

export const schema = {
  version: z.string().describe("Version of the schema"),
};

export const metadata = withToolFeatureFlag({
  name: "get_overview",
  description: "Show overview of Petriflow language",
  annotation: {
    title: "Overview of Petriflow language",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
});

export default async function getOverview({version}: InferSchema<typeof schema>) {
  return petriflowDataService.getOverview(version);
}
