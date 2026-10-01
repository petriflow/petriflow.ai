import {valid} from "semver";
import type {ValidationRule, ValidationIssue} from "../validation.service";
import {childText} from "./helpers";

/**
 * Verifies that the document `<version>` is a valid semantic version
 * (see https://semver.org). Applied to the top-level document version only.
 */
export const validVersionRule: ValidationRule = {
  name: "valid-version",
  description: "Ensure the document version is a valid semantic version.",

  validate(doc) {
    const issues: ValidationIssue[] = [];
    const root = doc.root() as any;
    const version = childText(root, "version");

    if (!version) {
      issues.push({
        rule: this.name,
        severity: "error",
        message: "The document is missing a <version> element."
      });
      return issues;
    }

    if (!valid(version)) {
      issues.push({
        rule: this.name,
        severity: "error",
        message: `Version "${version}" is not a valid semantic version. Expected a value matching the SemVer format (e.g. "1.2.3", with optional "-prerelease" or "+build" suffixes).`
      });
    }

    return issues;
  }
};