import petriflowDataService from "./petriflow-data.service";

/** Returns the versioned XSD from the release files installed in storage. */
export async function getSchemaXsd(version: string): Promise<string> {
  return petriflowDataService.getSchemaXsd(version);
}
