import {z} from "zod";
import {InferSchema} from "xmcp";
import {generateAppManifest} from "../services/app-manifest.service";
import {withToolFeatureFlag} from "../services/feature-flags.service";

export const schema = {
  appId: z.string().trim().min(1).describe("Unique application identifier (app_id)"),
  name: z.string().trim().min(1).describe("Application display name"),
  version: z.string().trim().min(1).describe("Application version, for example 1.0.0"),
  processes: z.array(z.string().trim().min(1)).min(1)
    .describe("Process ids included in the bundle; these must match the process XML ids"),
  description: z.string().trim().optional().describe("Application description; omitted when empty"),
  author: z.string().trim().optional().describe("Application author; omitted when empty"),
  title: z.string().trim().optional().describe("Case title; defaults to name"),
};

export const metadata = withToolFeatureFlag({
  name: "generate_app_manifest",
  description: "Generate manifest.xml for a Petriflow application bundle deployed to cloud NAE",
  annotation: {
    title: "Generate application manifest",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
});

export default async function generateAppManifestTool(input: InferSchema<typeof schema>) {
  return generateAppManifest(input);
}
