import type {Document} from "libxmljs5";

/**
 * Reads the trimmed text content of a node's first child element with the given
 * local name. Returns an empty string when the child is absent.
 */
export function childText(node: any, localName: string): string {
  const child = node.find?.(`./*[local-name()='${localName}']`)?.[0];
  return child?.text?.()?.trim() ?? "";
}

/** Returns all elements with the given local name anywhere in the document. */
export function findLocal(doc: Document, localName: string): any[] {
  return doc.find(`//*[local-name()='${localName}']`);
}

/** Returns all direct children of the document root with the given local name. */
export function findRootChildren(doc: Document, localName: string): any[] {
  return doc.find(`/*[local-name()='document']/*[local-name()='${localName}']`);
}

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Tests whether a string is a syntactically valid Java identifier. */
export function isJavaIdentifier(value: string): boolean {
  return IDENTIFIER_RE.test(value);
}

/**
 * Java reserved keywords that are not valid as identifiers.
 * See https://docs.oracle.com/javase/specs/jls/se17/html/jls-3.html#jls-3.9
 */
export const JAVA_RESERVED_WORDS = new Set([
  "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char",
  "class", "const", "continue", "default", "do", "double", "else", "enum",
  "extends", "final", "finally", "float", "for", "goto", "if", "implements",
  "import", "instanceof", "int", "interface", "long", "native", "new",
  "package", "private", "protected", "public", "return", "short", "static",
  "strictfp", "super", "switch", "synchronized", "this", "throw", "throws",
  "transient", "try", "void", "volatile", "while",
  "true", "false", "null",
]);

/**
 * Groovy reserved keywords (on top of the Java ones) that are not valid as
 * identifiers.
 * See http://docs.groovy-lang.org/latest/html/documentation/#_keywords
 */
export const GROOVY_RESERVED_WORDS = new Set([
  "as", "def", "in", "trait",
]);

/**
 * Parses a string as an integer. Returns null when the value is not a valid
 * integer literal (including signs), so floats like "1.5" are rejected.
 */
export function parseInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) {
    return null;
  }
  const n = Number(trimmed);
  return Number.isSafeInteger(n) ? n : null;
}
