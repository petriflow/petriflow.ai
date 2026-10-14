import petriflowVersionService from "../../services/petriflow-version.service";

export const metadata = {
  name: "petriflow-versions",
  title: "Petriflow language versions",
  description: "List available Petriflow language releases",
  mimeType: "application/json",
};

export default function listVersions(): string {
  return JSON.stringify({versions: petriflowVersionService.listVersions()}, null, 2);
}
