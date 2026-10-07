import type {ResourceCompletions} from "xmcp";
import releaseSyncService from "./release-sync.service";

export function createVersionCompletions(listVersions: () => string[]): ResourceCompletions {
  return {
    version: (value: string) => [...new Set(["latest", ...listVersions()])]
      .filter((version) => version.startsWith(value)),
  };
}

const versionCompletions = createVersionCompletions(() =>
  releaseSyncService.listVersions().map(({version}) => version),
);

export default versionCompletions;
