import releaseSyncService from "./release-sync.service";

/** Returns the latest stable version cached by release synchronization. */
export function getLatestVersion(): string {
  return releaseSyncService.getLatestVersion();
}
