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

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 &&
    value.every((entry) => typeof entry === "string" && entry.trim().length > 0);
}

/**
 * Validates component definitions when a release publishes them. Older releases do not ship
 * the file, so its absence is not an error; a present file must be well-formed.
 */
export function validateComponentsDefinitions(files: Record<string, string>, sourceName: string): void {
  const content = files["components-definitions.json"];
  if (content === undefined) return;

  const invalid = (message: string): never => {
    throw new Error(`${sourceName} contains invalid components-definitions.json: ${message}`);
  };

  let components: unknown;
  try {
    components = JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return invalid(message);
  }

  if (!components || typeof components !== "object" || Array.isArray(components)) {
    return invalid("component definitions must be a JSON object");
  }

  for (const [name, definition] of Object.entries(components)) {
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
      return invalid(`component ${name} must be a JSON object`);
    }

    const component = definition as Record<string, unknown>;
    if (!isNonEmptyStringArray(component.names)) {
      return invalid(`component ${name} names must be a non-empty array of strings`);
    }
    if (!isNonEmptyStringArray(component.fieldTypes)) {
      return invalid(`component ${name} fieldTypes must be a non-empty array of strings`);
    }
    if (typeof component.description !== "string" || !component.description.trim()) {
      return invalid(`component ${name} description must be a non-empty string`);
    }
    if (typeof component.whenToUse !== "string" || !component.whenToUse.trim()) {
      return invalid(`component ${name} whenToUse must be a non-empty string`);
    }
    if (component.params !== undefined) {
      if (!Array.isArray(component.params)) {
        return invalid(`component ${name} params must be an array`);
      }
      for (const [index, param] of component.params.entries()) {
        if (!param || typeof param !== "object" || Array.isArray(param)) {
          return invalid(`component ${name} params[${index}] must be a JSON object`);
        }
        const entry = param as Record<string, unknown>;
        for (const field of ["name", "type", "description"] as const) {
          if (typeof entry[field] !== "string" || !(entry[field] as string).trim()) {
            return invalid(`component ${name} params[${index}] ${field} must be a non-empty string`);
          }
        }
        if (typeof entry.required !== "boolean") {
          return invalid(`component ${name} params[${index}] required must be a boolean`);
        }
      }
    }
    if (component.examples !== undefined &&
      !(Array.isArray(component.examples) && component.examples.every((example) => typeof example === "string"))) {
      return invalid(`component ${name} examples must be an array of strings`);
    }
    if (component.deprecated !== undefined && typeof component.deprecated !== "boolean") {
      return invalid(`component ${name} deprecated must be a boolean`);
    }
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

  validateComponentsDefinitions(files, sourceName);

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
