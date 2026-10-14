import petriflowVersionService from "./petriflow-version.service";

/** Returns the latest version selected by the active Petriflow mode. */
export function getLatestVersion(): string {
  return petriflowVersionService.getLatestVersion();
}
