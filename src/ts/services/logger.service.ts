import {pino} from "pino";
import type {FastifyBaseLogger} from "fastify";
import {getSingleton} from "./singleton-registry.service";

interface LoggerState {
  current: FastifyBaseLogger;
}

const state = getSingleton<LoggerState>("netgrif.petriflow.ai/logger", () => ({
  current: pino({level: process.env.LOG_LEVEL ?? "info"}),
}));

export function getLogger(): FastifyBaseLogger {
  return state.current;
}

export function setLogger(log: FastifyBaseLogger): void {
  state.current = log;
}
