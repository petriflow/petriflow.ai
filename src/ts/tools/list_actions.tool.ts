import {z} from "zod";
import {InferSchema} from "xmcp";
import {getLatestVersion, getVersionedPath} from "../services/utils";
import {logger} from "../services/logger.service";
import fs from "node:fs";


const ACTIONS_FILE = "actions-def.json";

export const schema = {
  version: z.string().describe("Version of the schema"),
};

export const outputSchema = {
  actions: z.array(z.object({
    name: z.string().describe("Name of the action function"),
    signature: z.string().describe("Signature of the action function"),
    description: z.string().describe("Description of the action function"),
  })).describe("List of actions functions"),
};

export const metadata = {
  name: "list-actions",
  description: "Get list of available actions functions",
  annotation: {
    title: "Get list of available actions functions",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export default async function listActions({version}: InferSchema<typeof schema>) {
  if (version === "latest") {
    version = getLatestVersion();
    logger.info(`Using cached latest version: ${version}`);
  }

  const actionsFile = getVersionedPath(version, [ACTIONS_FILE]);
  const actionsContent = await fs.promises.readFile(actionsFile, {encoding: "utf-8"});
  const actions = JSON.parse(actionsContent);
  const formated = Object.keys(actions).map(k => {
    if (actions[k].alts) {
      let i = 0;
      return actions[k].alts.map((alt: any) => {
        return {
          name: k + `-${i++}`,
          signature: alt.signature,
          description: alt.description
        }
      });
    } else if (actions[k].dslChain) {
      return Object.keys(actions[k].dslChain).map(chain => {
        return {
          name: k + `-${chain}`,
          signature: actions[k].dslChain[chain].signature,
          description: actions[k].dslChain[chain].description
        }
      })
    } else {
      return [{
        name: k,
        signature: actions[k].signature,
        description: actions[k].description
      }];
    }
  }).flat();

  return {structuredContent: {actions: formated}}
}
