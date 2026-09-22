import {z} from "zod";
import {rcompare, valid} from "semver";
import cache from "../services/cache.service";
import {logger} from "../services/logger.service";

const GITHUB_API = "https://api.github.com/repos/{REPO}/releases"
const PETRIFLOW_GITHUB_REPO = "petriflow/petriflow";

export const outputSchema = {
  versions: z.array(z.object({
    version: z.string(),
    releaseDate: z.string(),
    prerelease: z.boolean(),
    latest: z.boolean()
  }))
}

export const metadata = {
  name: "list-versions",
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
  logger.info(`Fetching versions from ${GITHUB_API}`);
  const response = await fetch(GITHUB_API.replace("{REPO}", PETRIFLOW_GITHUB_REPO))
  if (!response.ok) {
    throw new Error(`Failed to fetch versions: ${response.status} ${response.statusText}`);
  }

  const releases = await response.json();
  logger.info(`Fetched ${releases.length} Petriflow releases`);
  const stable = releases.filter((release: any) => !release.prerelease && !release.draft);
  const latestTag = stable
    .map((release: any) => release.tag_name.replace(/^v/, ""))
    .filter(valid)
    .sort(rcompare)[0] ?? null
  logger.info(`Latest stable version: ${latestTag}`);

  const versions = releases.map((release: any) => ({
    version: release.tag_name.replace(/^v/, ""),
    releaseDate: release.published_at,
    prerelease: release.prerelease || release.draft,
    latest: latestTag !== null && release.tag_name.replace(/^v/, "") === latestTag
  }));

  logger.info(`Returning ${versions.length} versions`);

  cache.set("latestVersion", latestTag);
  logger.info(`Cached latest version: ${latestTag}`);

  return {structuredContent: {versions}};
}
