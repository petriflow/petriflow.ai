import {parseXml} from "libxmljs5";
import {expect, test} from "vitest";
import {
  childText,
  findLocal,
  findRootChildren,
  isJavaIdentifier,
  JAVA_RESERVED_WORDS,
  GROOVY_RESERVED_WORDS,
  parseInteger,
} from "../../../src/ts/services/rules/helpers";

test("reads trimmed child text and local-name matches across namespaces", () => {
  const document = parseXml(`
    <document xmlns="urn:petriflow">
      <version> 1.2.3 </version>
      <place><id> place_1 </id></place>
    </document>
  `);

  expect(childText(document.root(), "version")).toBe("1.2.3");
  expect(childText(document.root(), "missing")).toBe("");
  expect(findRootChildren(document, "place")).toHaveLength(1);
  expect(childText(findRootChildren(document, "place")[0], "id")).toBe("place_1");
  expect(findLocal(document, "id")).toHaveLength(1);
});

test("accepts Java identifier syntax and exposes reserved keyword sets", () => {
  expect(isJavaIdentifier("_field2")).toBe(true);
  expect(isJavaIdentifier("$field")).toBe(true);
  expect(isJavaIdentifier("2field")).toBe(false);
  expect(isJavaIdentifier("field-name")).toBe(false);
  expect(JAVA_RESERVED_WORDS.has("class")).toBe(true);
  expect(GROOVY_RESERVED_WORDS.has("def")).toBe(true);
});

test("parses only safe integer literals", () => {
  expect(parseInteger("  +12 ")).toBe(12);
  expect(parseInteger("-0")).toBe(-0);
  expect(parseInteger("1.5")).toBeNull();
  expect(parseInteger("12x")).toBeNull();
  expect(parseInteger("9007199254740992")).toBeNull();
});
