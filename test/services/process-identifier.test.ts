import {expect, test} from "vitest";
import {
  classifyProcessIdentifier,
  isValidAppId,
  isValidPlainProcessId,
  parseProcessIdentifier,
} from "../../src/ts/services/process-identifier";

test("parses a scoped process identifier", () => {
  expect(parseProcessIdentifier("Objednavky/user_ASK")).toEqual({
    appId: "Objednavky",
    processId: "user_ASK",
  });
  expect(parseProcessIdentifier("my-app.v2/leave-request")).toEqual({
    appId: "my-app.v2",
    processId: "leave-request",
  });
  expect(parseProcessIdentifier("app/new_model-5")).toEqual({
    appId: "app",
    processId: "new_model-5",
  });
});

test("rejects malformed scoped process identifiers", () => {
  for (const value of ["invoice", "", "/user_ASK", "Objednavky/", "a/b/c", "-app/process", "app/process name"]) {
    expect(parseProcessIdentifier(value), value).toBeNull();
  }
});

test("accepts safe plain identifiers without an application context", () => {
  expect(isValidPlainProcessId("invoice")).toBe(true);
  expect(isValidPlainProcessId("new_model-5")).toBe(true);
  expect(isValidPlainProcessId("2invoice")).toBe(true);
  expect(isValidPlainProcessId("")).toBe(false);
  expect(isValidPlainProcessId("_invoice")).toBe(false);
  expect(isValidPlainProcessId("with/slash")).toBe(false);
  expect(isValidPlainProcessId("with space")).toBe(false);
});

test("validates application ids as safe folder names", () => {
  expect(isValidAppId("app")).toBe(true);
  expect(isValidAppId("Objednavky")).toBe(true);
  expect(isValidAppId("my-app.v2")).toBe(true);
  expect(isValidAppId("")).toBe(false);
  expect(isValidAppId("-app")).toBe(false);
  expect(isValidAppId("app/sub")).toBe(false);
  expect(isValidAppId("app name")).toBe(false);
});

test("classifies plain and scoped identifiers", () => {
  expect(classifyProcessIdentifier("invoice")).toEqual({kind: "plain", processId: "invoice"});
  expect(classifyProcessIdentifier("new_model-5")).toEqual({kind: "plain", processId: "new_model-5"});
  expect(classifyProcessIdentifier("Objednavky/user_ASK")).toEqual({
    kind: "scoped",
    appId: "Objednavky",
    processId: "user_ASK",
  });
  expect(classifyProcessIdentifier("a/b/c")).toBeNull();
  expect(classifyProcessIdentifier("with space")).toBeNull();
});
