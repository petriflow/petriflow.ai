import {InferSchema} from "xmcp";
import petriflowDataService from "../../../../services/petriflow-data.service";
import versionCompletions from "../../../../services/version-completions.service";
import {z} from "zod";

export const schema = {
  version: z.string().describe("Version of the schema"),
};

export const complete = versionCompletions;

export const metadata = {
  name: "overview",
  title: "Petriflow Overview",
  description: "Show overview of Petriflow language",
  mimeType: "text/markdown",
};

export default function getOverview({version}: InferSchema<typeof schema>) {
  return petriflowDataService.getOverview(version);
}
