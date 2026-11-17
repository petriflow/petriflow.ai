import {parseXml} from "libxmljs5";
import {describe, expect, test} from "vitest";
import type {ValidationRule} from "../../../src/ts/services/validation.service";
import {arcConnectivityRule} from "../../../src/ts/services/rules/arc-connectivity.rule";
import {arcDirectionRule} from "../../../src/ts/services/rules/arc-direction.rule";
import {placeTokensRule} from "../../../src/ts/services/rules/place-tokens.rule";
import {uniqueActionIdsRule} from "../../../src/ts/services/rules/unique-action-ids.rule";
import {uniqueIdsRule} from "../../../src/ts/services/rules/unique-ids.rule";
import {validIdentifiersRule} from "../../../src/ts/services/rules/valid-identifiers.rule";
import {validProcessIdentifierRule} from "../../../src/ts/services/rules/valid-process-identifier.rule";
import {validVersionRule} from "../../../src/ts/services/rules/valid-version.rule";
import {rules} from "../../../src/ts/services/rules";

async function runRule(rule: ValidationRule, contents: string, appId?: string) {
  const xml = `<document>${contents}</document>`;
  const doc = parseXml(xml);
  return rule.validate(doc, {version: "1.2.3", xml, appId});
}

test("registers every semantic rule exactly once", () => {
  expect(rules.map(({name}) => name)).toEqual([
    "unique-ids",
    "unique-action-ids",
    "valid-identifiers",
    "valid-process-identifier",
    "valid-version",
    "arc-connectivity",
    "arc-direction",
    "place-tokens",
    "action-validation",
  ]);
});

describe("unique-ids rule", () => {
  test("warns about missing ids and errors on duplicates of the same element type", async () => {
    const issues = await runRule(uniqueIdsRule, `
      <transition><id>approve</id></transition>
      <transition><id>approve</id></transition>
      <place><id>queue</id></place>
      <place />
    `);

    expect(issues).toHaveLength(2);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({rule: "unique-ids", severity: "warning"}),
      expect.objectContaining({rule: "unique-ids", severity: "error", message: expect.stringContaining('"approve"')}),
    ]));
  });
});

describe("unique-action-ids rule", () => {
  test("reports missing and repeated action id attributes", async () => {
    const issues = await runRule(uniqueActionIdsRule, `
      <action id="save">save()</action>
      <action id="save">saveAgain()</action>
      <action>missingId()</action>
    `);

    expect(issues).toHaveLength(2);
    expect(issues.map(({severity}) => severity)).toEqual(["error", "error"]);
    expect(issues[0].message).toContain('Duplicate action id "save"');
    expect(issues[1].message).toContain("missing its required id");
  });
});

describe("valid-identifiers rule", () => {
  test("accepts identifiers and reports malformed or reserved names", async () => {
    const valid = await runRule(validIdentifiersRule, `
      <place><id>_valid2</id></place>
      <transition><id>$next</id></transition>
    `);
    const invalid = await runRule(validIdentifiersRule, `
      <place><id>2invalid</id></place>
      <transition><id>class</id></transition>
      <action id="def">run()</action>
    `);

    expect(valid).toEqual([]);
    expect(invalid).toHaveLength(3);
    expect(invalid.map(({severity}) => severity)).toEqual(["error", "error", "error"]);
    expect(invalid.some(({message}) => message.includes("reserved keyword"))).toBe(true);
  });
});

describe("valid-process-identifier rule", () => {
  test("allows a plain id without application context", async () => {
    expect(await runRule(validProcessIdentifierRule, "<id>invoice</id>")).toEqual([]);
  });

  test("allows a well-formed scoped id without application context", async () => {
    expect(await runRule(validProcessIdentifierRule, "<id>Objednavky/user_ASK</id>")).toEqual([]);
  });

  test("requires a matching prefix in application context", async () => {
    expect(await runRule(validProcessIdentifierRule, "<id>invoice</id>", "Objednavky")).toEqual([
      expect.objectContaining({
        rule: "valid-process-identifier",
        severity: "error",
        message: expect.stringContaining("Objednavky/"),
      }),
    ]);
    expect(await runRule(validProcessIdentifierRule, "<id>Other/user_ASK</id>", "Objednavky"))
      .toHaveLength(1);
    expect(await runRule(validProcessIdentifierRule, "<id>Objednavky/user_ASK</id>", "Objednavky"))
      .toEqual([]);
  });

  test("rejects malformed ids in both modes", async () => {
    for (const id of ["a/b/c", "app/process name", "/process", "app/"]) {
      expect(await runRule(validProcessIdentifierRule, `<id>${id}</id>`), id).toHaveLength(1);
      expect(await runRule(validProcessIdentifierRule, `<id>${id}</id>`, "app"), id).toHaveLength(1);
    }
  });

  test("reports a missing id", async () => {
    expect(await runRule(validProcessIdentifierRule, "")).toHaveLength(1);
  });
});

describe("valid-version rule", () => {
  test("requires a valid SemVer document version", async () => {
    expect(await runRule(validVersionRule, "")).toEqual([
      expect.objectContaining({rule: "valid-version", severity: "error", message: expect.stringContaining("missing")}),
    ]);
    expect(await runRule(validVersionRule, "<version>1.2</version>")).toHaveLength(1);
    expect(await runRule(validVersionRule, "<version>1.2.3-rc.1</version>")).toEqual([]);
  });
});

describe("arc-connectivity rule", () => {
  test("reports both endpoints that reference unknown place or transition ids", async () => {
    const issues = await runRule(arcConnectivityRule, `
      <place><id>p1</id></place>
      <arc><id>a1</id><sourceId>missingSource</sourceId><destinationId>missingDestination</destinationId></arc>
    `);

    expect(issues).toHaveLength(2);
    expect(issues[0].message).toContain('sourceId "missingSource"');
    expect(issues[1].message).toContain('destinationId "missingDestination"');
  });
});

describe("arc-direction rule", () => {
  test("rejects same-type endpoints but leaves unknown endpoints to connectivity validation", async () => {
    const issues = await runRule(arcDirectionRule, `
      <place><id>p1</id></place>
      <place><id>p2</id></place>
      <transition><id>t1</id></transition>
      <arc><id>sameType</id><sourceId>p1</sourceId><destinationId>p2</destinationId></arc>
      <arc><id>valid</id><sourceId>p1</sourceId><destinationId>t1</destinationId></arc>
      <arc><id>unknown</id><sourceId>unknown</sourceId><destinationId>p1</destinationId></arc>
    `);

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('Arc "sameType" connects two places');
  });
});

describe("place-tokens rule", () => {
  test("accepts zero and rejects missing, fractional, or negative token counts", async () => {
    const issues = await runRule(placeTokensRule, `
      <place><id>zero</id><tokens>0</tokens></place>
      <place><id>missing</id></place>
      <place><id>fraction</id><tokens>1.5</tokens></place>
      <place><id>negative</id><tokens>-1</tokens></place>
    `);

    expect(issues).toHaveLength(3);
    expect(issues.map(({message}) => message)).toEqual(expect.arrayContaining([
      expect.stringContaining('Place "missing" is missing'),
      expect.stringContaining('Place "fraction" has tokens'),
      expect.stringContaining('Place "negative" has tokens'),
    ]));
  });
});
