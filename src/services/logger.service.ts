import {pino} from "pino";
import type {FastifyBaseLogger} from "fastify";

export let logger: FastifyBaseLogger = pino({
  level: process.env.LOG_LEVEL ?? "info"
});

export function setLogger(log: FastifyBaseLogger): void {
  logger = log;
}
