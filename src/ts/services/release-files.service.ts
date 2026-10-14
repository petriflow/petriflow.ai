/** Validates the required relative paths without opening any release files. */
export function validateReleasePaths(paths: string[], sourceName: string): void {
  for (const relativePath of paths) {
    const segments = relativePath.split("/");
    if (!relativePath || relativePath.startsWith("/") || relativePath.includes("\\") ||
      /^[A-Za-z]:/.test(relativePath) ||
      segments.some((segment) => !segment || segment === "." || segment === "..")) {
      throw new Error(`Unsafe path in ${sourceName}: ${relativePath}`);
    }
  }

  for (const filename of ["petriflow.schema.xsd", "overview.md", "actions-definitions.json"]) {
    if (!paths.includes(filename)) {
      throw new Error(`${sourceName} is missing required file ${filename}`);
    }
  }

  if (!paths.some((relativePath) => relativePath.startsWith("elements/") && relativePath.endsWith(".xsd"))) {
    throw new Error(`${sourceName} is missing element XSD files`);
  }
  if (!paths.some((relativePath) => relativePath.startsWith("examples/") && relativePath.endsWith(".xml"))) {
    throw new Error(`${sourceName} is missing XML examples`);
  }
}

/** Validates text content for remote release ZIPs. */
export function validateReleaseFiles(files: Record<string, string>, sourceName: string): void {
  for (const filename of ["petriflow.schema.xsd", "overview.md", "actions-definitions.json"]) {
    if (!files[filename]?.trim()) {
      throw new Error(`${sourceName} is missing required file ${filename}`);
    }
  }

  try {
    const actions: unknown = JSON.parse(files["actions-definitions.json"]);
    if (!actions || typeof actions !== "object" || Array.isArray(actions)) {
      throw new Error("Action definitions must be a JSON object");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${sourceName} contains invalid actions-definitions.json: ${message}`);
  }

  if (!Object.keys(files).some((name) => name.startsWith("elements/") && name.endsWith(".xsd"))) {
    throw new Error(`${sourceName} is missing element XSD files`);
  }
  if (!Object.keys(files).some((name) => name.startsWith("examples/") && name.endsWith(".xml"))) {
    throw new Error(`${sourceName} is missing XML examples`);
  }

  for (const name of Object.keys(files)) {
    const segments = name.split("/");
    if (!name || name.startsWith("/") || name.includes("\\") || /^[A-Za-z]:/.test(name) ||
      segments.some((segment) => !segment || segment === "." || segment === "..")) {
      throw new Error(`Unsafe path in ${sourceName}: ${name}`);
    }
  }
}
