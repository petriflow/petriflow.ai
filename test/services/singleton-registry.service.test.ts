import {randomUUID} from "node:crypto";
import {expect, test, vi} from "vitest";
import {getSingleton} from "../../src/ts/services/singleton-registry.service";

test("reuses an instance and invokes its factory once per key", () => {
  const key = `test/reuse-${randomUUID()}`;
  let calls = 0;
  const factory = () => ({created: ++calls});

  const first = getSingleton(key, factory);
  const second = getSingleton(key, factory);

  expect(second).toBe(first);
  expect(calls).toBe(1);
});

test("keeps different keys independent", () => {
  const prefix = `test/independent-${randomUUID()}`;

  const first = getSingleton(`${prefix}/first`, () => ({id: "first"}));
  const second = getSingleton(`${prefix}/second`, () => ({id: "second"}));

  expect(second).not.toBe(first);
  expect(first.id).toBe("first");
  expect(second.id).toBe("second");
});

test("shares the registry after module reload", async () => {
  const key = `test/module-reload-${randomUUID()}`;
  const first = getSingleton(key, () => ({value: "first"}));

  vi.resetModules();
  const reloadedModule = await import("../../src/ts/services/singleton-registry.service");
  const second = reloadedModule.getSingleton(key, () => ({value: "second"}));

  expect(second).toBe(first);
  expect(second.value).toBe("first");
});

test("retries a factory that previously threw", () => {
  const key = `test/retry-${randomUUID()}`;
  let calls = 0;
  const factory = () => {
    calls++;
    if (calls === 1) throw new Error("initialization failed");
    return {created: true};
  };

  expect(() => getSingleton(key, factory)).toThrow("initialization failed");
  expect(getSingleton(key, factory)).toEqual({created: true});
  expect(calls).toBe(2);
});
