import type {ResourceCompletions} from "xmcp";
import petriflowVersionService from "./petriflow-version.service";

export function createVersionCompletions(listVersions: () => string[]): ResourceCompletions {
  return {
    version: (value: string) => [...new Set(["latest", ...listVersions()])]
      .filter((version) => version.startsWith(value)),
  };
}

const versionCompletions = createVersionCompletions(() =>
  petriflowVersionService.listVersions().map(({version}) => version),
);

export default versionCompletions;
