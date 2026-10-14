import {z} from "zod";
import {InferSchema} from "xmcp";
import petriflowDataService from "../services/petriflow-data.service";

export const schema = {
  version: z.string().describe("Version of the example"),
  app: z.string().describe("Name of the app"),
  example: z.string().describe("Name of the example"),
};

export const metadata = {
  name: "get-example",
  description: "Get the content of an example process",
  annotation: {
    title: "Get the content of an example process",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export default async function getExample({version, app, example}: InferSchema<typeof schema>) {
  return petriflowDataService.getExample(version, app, example);
}
