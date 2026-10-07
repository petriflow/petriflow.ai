import releaseSyncService from "../../services/release-sync.service";

export const metadata = {
  name: "petriflow-versions",
  title: "Petriflow language versions",
  description: "List available Petriflow language releases",
  mimeType: "application/json",
};

export default function listVersions(): string {
  return JSON.stringify({versions: releaseSyncService.listVersions()}, null, 2);
}
