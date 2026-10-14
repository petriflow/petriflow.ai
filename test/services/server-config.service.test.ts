import {expect, test} from "vitest";
import {getPetriflowMode, getServerHost} from "../../src/ts/services/server-config.service";

test("defaults to loopback when HOST is unset or blank", () => {
  expect(getServerHost({})).toBe("127.0.0.1");
  expect(getServerHost({HOST: ""})).toBe("127.0.0.1");
  expect(getServerHost({HOST: "   "})).toBe("127.0.0.1");
});

test("uses a configured host for container networking", () => {
  expect(getServerHost({HOST: "0.0.0.0"})).toBe("0.0.0.0");
});

test("defaults to REMOTE for an unset or blank mode", () => {
  expect(getPetriflowMode({})).toBe("REMOTE");
  expect(getPetriflowMode({PETRIFLOW_MODE: ""})).toBe("REMOTE");
  expect(getPetriflowMode({PETRIFLOW_MODE: "   "})).toBe("REMOTE");
});

test("accepts LOCAL and REMOTE case-insensitively", () => {
  expect(getPetriflowMode({PETRIFLOW_MODE: "LOCAL"})).toBe("LOCAL");
  expect(getPetriflowMode({PETRIFLOW_MODE: " remote "})).toBe("REMOTE");
  expect(getPetriflowMode({PETRIFLOW_MODE: "local"})).toBe("LOCAL");
});

test("rejects an unsupported mode", () => {
  expect(() => getPetriflowMode({PETRIFLOW_MODE: "offline"}))
    .toThrow(/PETRIFLOW_MODE must be LOCAL or REMOTE/i);
});
