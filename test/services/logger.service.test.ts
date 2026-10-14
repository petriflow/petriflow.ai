import {pino} from "pino";
import {expect, test, vi} from "vitest";

test("uses a default logger before Fastify configures it", async () => {
  const {getLogger} = await import("../../src/ts/services/logger.service");
  expect(typeof getLogger().info).toBe("function");
});

test("returns the logger set by another module evaluation", async () => {
  const firstModule = await import("../../src/ts/services/logger.service");
  const configuredLogger = pino({level: "silent"});
  firstModule.setLogger(configuredLogger);

  try {
    vi.resetModules();
    const reloadedModule = await import("../../src/ts/services/logger.service");
    expect(reloadedModule.getLogger()).toBe(configuredLogger);
  } finally {
    firstModule.setLogger(pino({level: "silent"}));
  }
});
