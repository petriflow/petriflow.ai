import {InferSchema} from "xmcp";
import {z} from "zod";
import petriflowDataService from "../../../../../../../services/petriflow-data.service";
import versionCompletions from "../../../../../../../services/version-completions.service";

export const schema = {
  version: z.string().describe("Petriflow language version"),
  app: z.string().describe("Name of the app"),
  example: z.string().describe("Name of the example"),
};

export const complete = versionCompletions;

export const metadata = {
  name: "petriflow-example",
  title: "Petriflow process example",
  description: "Get the XML content of a Petriflow process example",
  mimeType: "application/xml",
};

export default function getExample({version, app, example}: InferSchema<typeof schema>): string {
  return petriflowDataService.getExample(version, app, example);
}
