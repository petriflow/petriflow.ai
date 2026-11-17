import {isValidAppId, parseProcessIdentifier} from "./process-identifier";

export interface AppManifestMetadata {
  appId: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  title?: string;
}

export interface AppManifestInput extends AppManifestMetadata {
  processes: string[];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function textField(id: string, value?: string): string[] {
  const trimmed = value?.trim();
  return [
    "\t\t<dataField type=\"text\">",
    `\t\t\t<id>${id}</id>`,
    ...(trimmed ? [`\t\t\t<value>${escapeXml(trimmed)}</value>`] : []),
    "\t\t\t<version>1</version>",
    "\t\t</dataField>",
  ];
}

function caseRefField(id: string, values: string[]): string[] {
  return [
    "\t\t<dataField type=\"caseRef\">",
    `\t\t\t<id>${id}</id>`,
    "\t\t\t<allowedNets>",
    ...values.map(value => `\t\t\t\t<value>${escapeXml(value)}</value>`),
    "\t\t\t</allowedNets>",
    "\t\t\t<version>1</version>",
    "\t\t</dataField>",
  ];
}

function validateManifestInput(input: AppManifestInput): void {
  if (!isValidAppId(input.appId)) {
    throw new Error(`Application id "${input.appId}" is not valid. It must match [A-Za-z0-9][A-Za-z0-9._-]*.`);
  }

  const seen = new Set<string>();
  for (const processId of input.processes) {
    if (seen.has(processId)) {
      throw new Error(`Duplicate process id: ${processId}`);
    }
    seen.add(processId);

    const identifier = parseProcessIdentifier(processId);
    if (!identifier) {
      throw new Error(`Process id "${processId}" must have the form "<appId>/<processId>".`);
    }
    if (identifier.appId !== input.appId) {
      throw new Error(
        `Process id "${processId}" does not belong to application "${input.appId}".`,
      );
    }
  }
}

// TODO: add the optional NAE application fields that are not generated yet:
// imports, dependencies, assets, app_meta.
export function generateAppManifest(input: AppManifestInput): string {
  validateManifestInput(input);
  const title = input.title?.trim() || input.name;
  const lines = [
    "<cases>",
    "\t<case>",
    `\t\t<title>${escapeXml(title)}</title>`,
    ...textField("app_id", input.appId),
    ...textField("name", input.name),
    ...textField("description", input.description),
    ...textField("version", input.version),
    ...textField("author", input.author),
    ...caseRefField("processes", input.processes),
    "\t</case>",
    "</cases>",
  ];

  return lines.join("\n") + "\n";
}
