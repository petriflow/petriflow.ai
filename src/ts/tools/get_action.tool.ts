import {z} from "zod";
import {InferSchema} from "xmcp";
import {getLatestVersion, getVersionedPath} from "../services/utils";
import {logger} from "../services/logger.service";
import fs from "node:fs";


const ACTIONS_FILE = "actions-def.json";

export const schema = {
  version: z.string().describe("Version of the schema"),
  name: z.string().describe("Name of the action"),
};

export const outputSchema = {
  action: z.object({
    name: z.string().describe("Name of the action"),
    signature: z.string().describe("Signature of the action"),
    description: z.string().describe("Description of the action"),
    params: z.array(z.object({
      name: z.string().describe("Name of the parameter"),
      type: z.string().describe("Type of the parameter"),
      description: z.string().describe("Description of the parameter"),
      required: z.boolean().describe("Whether the parameter is required"),
    }).describe("Parameters of the action")),
    examples: z.array(z.string()).describe("Examples of the action"),
  })
};

export const metadata = {
  name: "get-action",
  description: "Get complete definition of an action",
  annotation: {
    title: "Get complete definition of an action",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export default async function getAction({name, version}: InferSchema<typeof schema>) {
  if (version === "latest") {
    version = getLatestVersion();
    logger.info(`Using cached latest version: ${version}`);
  }

  const actionsFile = getVersionedPath(version, [ACTIONS_FILE]);
  const actionsContent = await fs.promises.readFile(actionsFile, {encoding: "utf-8"});
  const actions = JSON.parse(actionsContent);
  logger.info(`Loaded actions from ${actionsFile}`);

  const action = actions[name];
  if (!action) {
    throw new Error(`Action ${name} not found`);
  }
  action.name = name;
  logger.info(`Action: ${JSON.stringify(action)}`);

  return {structuredContent: {action}}; //TODO tu to padne na schema validation
}
