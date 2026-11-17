/** Application and process ids double as safe directory and file names. */
export const SAFE_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Application ids double as safe directory names inside the package. */
export const APP_ID_PATTERN = SAFE_SEGMENT_PATTERN;

export interface ProcessIdentifier {
  appId: string;
  processId: string;
}

export type ClassifiedProcessIdentifier =
  | {kind: "plain"; processId: string}
  | ({kind: "scoped"} & ProcessIdentifier);

export function isValidAppId(value: string): boolean {
  return APP_ID_PATTERN.test(value);
}

/** A standalone process id is a safe file-name segment. */
export function isValidPlainProcessId(value: string): boolean {
  return SAFE_SEGMENT_PATTERN.test(value);
}

/** Parses an application-scoped process id of the form `appId/processId`. */
export function parseProcessIdentifier(value: string): ProcessIdentifier | null {
  const parts = value.split("/");
  if (parts.length !== 2) {
    return null;
  }

  const [appId, processId] = parts;
  if (!isValidAppId(appId) || !isValidPlainProcessId(processId)) {
    return null;
  }

  return {appId, processId};
}

/** Classifies an id as plain or application-scoped, or returns null when malformed. */
export function classifyProcessIdentifier(value: string): ClassifiedProcessIdentifier | null {
  if (value.includes("/")) {
    const parsed = parseProcessIdentifier(value);
    return parsed ? {kind: "scoped", ...parsed} : null;
  }

  return isValidPlainProcessId(value) ? {kind: "plain", processId: value} : null;
}
