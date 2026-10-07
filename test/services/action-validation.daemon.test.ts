import {EventEmitter} from "node:events";
import {beforeEach, expect, test, vi} from "vitest";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {...actual, spawn: spawnMock};
});

import {ActionValidationService} from "../../src/ts/services/action-validation.service";

function prepareFakeDaemon(responseFor: (request: Record<string, unknown>) => string = () => JSON.stringify({ok: true, issues: []})) {
  const requests: Record<string, unknown>[] = [];
  const daemon = new EventEmitter() as EventEmitter & Record<string, any>;
  daemon.killed = false;
  daemon.stdout = new EventEmitter();
  daemon.stderr = new EventEmitter();
  daemon.stdin = {
    write(line: string) {
      const request = JSON.parse(line) as Record<string, unknown>;
      requests.push(request);
      queueMicrotask(() => daemon.stdout.emit("data", `${responseFor(request)}\n`));
      return true;
    },
  };
  spawnMock.mockImplementation(() => {
    queueMicrotask(() => daemon.emit("spawn"));
    return daemon;
  });
  return requests;
}

beforeEach(() => spawnMock.mockReset());

test("sends normalized action requests and reuses the spawned daemon", async () => {
  const requests = prepareFakeDaemon();
  const service = new ActionValidationService();

  const result = await service.validate("field: f.fieldId;");

  expect(result).toEqual({valid: true, issues: []});
  expect(requests).toEqual([{source: "Field field = null\n"}]);
  expect(spawnMock).toHaveBeenCalledTimes(1);
  await service.validateWithFunctions("return helper()", [{name: "helper", body: "return 1"}]);
  await service.validateFunction("return 2");
  expect(requests.slice(1)).toEqual([
    {source: "return helper()", functions: [{name: "helper", body: "return 1"}]},
    {function: "return 2"},
  ]);
  expect(spawnMock).toHaveBeenCalledTimes(1);
});

test("rejects a malformed response from the daemon", async () => {
  prepareFakeDaemon(() => "not-json");
  const service = new ActionValidationService();

  await expect(service.validateFunction("return 1"))
    .rejects.toThrow("Invalid response from Groovy validator: not-json");
});
