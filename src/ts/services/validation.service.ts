import {parseXml} from "libxmljs2";
import {getSchemaXsd} from "./schema.service";
import {logger} from "./logger.service";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  /** Identifier of the rule (or "xsd") that produced this issue. */
  rule: string;
  /** Severity of the issue. */
  severity: ValidationSeverity;
  /** Human-readable description, detailed enough to locate and fix the problem. */
  message: string;
  /** Optional XPath-like location of the offending element (e.g. "document/transition[3]"). */
  path?: string;
  /** 1-based line number in the input XML, when available. */
  line?: number;
  /** 1-based column number in the input XML, when available. */
  column?: number;
}

export interface ValidationResult {
  /** True when the input is both well-formed and passes all checks. */
  valid: boolean;
  issues: ValidationIssue[];
}

/** Context passed to each rule. */
export interface ValidationContext {
  /** The resolved version that was validated against. */
  version: string;
  /** Well-formed input XML as a string. */
  xml: string;
}

/**
 * A single semantic validation rule.
 *
 * Implement `validate` to inspect the parsed DOM and return zero or more issues.
 * Rules run only after the document is well-formed and schema-valid, so they can
 * safely assume a correctly-shaped document.
 */
export interface ValidationRule {
  /** Unique rule identifier, used to label produced issues. */
  name: string;
  /** Human-readable description of what this rule checks. */
  description: string;
  /**
   * Inspects the parsed DOM and returns zero or more issues.
   *
   * May return a Promise to support asynchronous checks (e.g. the Groovy action
   * compilation rules). Synchronous rules return a plain array, which the
   * service awaits transparently.
   */
  validate(doc: ReturnType<typeof parseXml>, ctx: ValidationContext): ValidationIssue[] | Promise<ValidationIssue[]>;
}

/**
 * Maps libxml2 schema validation error codes to a short plain-English description.
 * Used as a suffix when the libxml message alone would be ambiguous.
 */
const XSD_ERROR_DESCRIPTIONS: Record<number, string> = {
  1824: "value is not valid for its declared type",
  1825: "invalid whitespace/structure value",
  1868: "undeclared element",
  1871: "element missing or not expected at this position",
};

/** Codes from libxml2 that indicate a warning rather than an error. */
const WARNING_CODES = new Set<number>();

export class ValidationService {
  private readonly _rules = new Map<string, ValidationRule>();

  /**
   * Registers a validation rule. Later registrations with the same name override
   * earlier ones.
   */
  registerRule(rule: ValidationRule): void {
    this._rules.set(rule.name, rule);
  }

  /** Registers multiple rules at once. */
  registerRules(rules: ValidationRule[]): void {
    for (const rule of rules) {
      this.registerRule(rule);
    }
  }

  /** Returns the rules currently registered, in registration order. */
  rules(): ValidationRule[] {
    return Array.from(this._rules.values());
  }

  /**
   * Validates the given XML against the Petriflow schema of the specified version
   * and runs all registered semantic rules.
   *
   * @param xml raw process XML string
   * @param version Petriflow version whose cached schema should be used
   * @returns a result whose `valid` is false if any issue (error severity) was found
   */
  async validate(xml: string, version: string): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];

    // --- 1. Well-formedness ---
    let doc: ReturnType<typeof parseXml>;
    try {
      doc = parseXml(xml);
    } catch (err) {
      const e = err as {message?: string; line?: number; column?: number};
      issues.push({
        rule: "xml",
        severity: "error",
        message: `XML is not well-formed: ${e.message ?? "unknown parse error"}`,
        line: e.line ?? undefined,
        column: e.column ?? undefined
      });
      return {valid: false, issues};
    }

    // --- 2. XSD schema validation ---
    const xsd = await getSchemaXsd(version);
    const schemaDoc = parseXml(xsd);
    doc.validate(schemaDoc);

    for (const e of doc.validationErrors) {
      issues.push({
        rule: "xsd",
        severity: WARNING_CODES.has(e.code ?? -1) ? "warning" : "error",
        message: this.describeXsdError(e as {message?: string; code?: number; line?: number; column?: number}),
        line: e.line ?? undefined,
        column: e.column ?? undefined
      });
    }

    // --- 3. Semantic rules ---
    const ctx: ValidationContext = {version, xml};
    for (const rule of this._rules.values()) {
      let ruleIssues: ValidationIssue[];
      try {
        ruleIssues = await rule.validate(doc, ctx);
      } catch (err) {
        ruleIssues = [{
          rule: rule.name,
          severity: "error",
          message: `Rule "${rule.name}" threw while validating: ${(err as Error).message}`
        }];
      }
      issues.push(...ruleIssues);
    }

    const valid = !issues.some(i => i.severity === "error");

    logger.info(`Validation of version ${version}: ${valid ? "valid" : "invalid"} (${issues.length} issue(s))`);
    return {valid, issues};
  }

  private describeXsdError(e: {message?: string; code?: number; line?: number; column?: number}): string {
    const code = e.code ?? -1;
    const base = e.message?.trim();
    const parts: string[] = [];
    if (base) {
      parts.push(base);
    }
    const short = XSD_ERROR_DESCRIPTIONS[code];
    if (!base && short) {
      parts.push(short);
    }
    const location = this.formatLocation(e.line, e.column);
    if (location) {
      parts.push(`at ${location}`);
    }
    return parts.join(" ") || `schema validation error (code ${code})`;
  }

  private formatLocation(line?: number, column?: number): string {
    if (line == null) {
      return "";
    }
    return column ? `line ${line}, column ${column}` : `line ${line}`;
  }
}

export default new ValidationService();