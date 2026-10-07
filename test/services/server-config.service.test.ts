import {expect, test} from "vitest";
import {getServerHost} from "../../src/ts/services/server-config.service";

test("defaults to loopback when HOST is unset or blank", () => {
  expect(getServerHost({})).toBe("127.0.0.1");
  expect(getServerHost({HOST: ""})).toBe("127.0.0.1");
  expect(getServerHost({HOST: "   "})).toBe("127.0.0.1");
});

test("uses a configured host for container networking", () => {
  expect(getServerHost({HOST: "0.0.0.0"})).toBe("0.0.0.0");
});
