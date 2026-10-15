import {z} from "zod";
import petriflowVersionService from "../services/petriflow-version.service";

export const outputSchema = {
  versions: z.array(z.object({
    version: z.string(),
    releaseDate: z.string(),
    prerelease: z.boolean(),
    latest: z.boolean()
  }))
}

export const metadata = {
  name: "list_versions",
  description: "List all versions of Petriflow language",
  annotation: {
    title: "Get XSD schema of Petriflow language",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

export default async function getVersions() {
  return {structuredContent: {versions: petriflowVersionService.listVersions()}};
}
