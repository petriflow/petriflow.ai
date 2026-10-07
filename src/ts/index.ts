import Fastify from "fastify";
import {xmcpHandler} from "@xmcp/adapter";
import {fastifyStatic} from "@fastify/static";
import path from "node:path";
import {existsSync} from "node:fs";
import cache from "./services/cache.service";
import {setLogger, logger} from "./services/logger.service";
import validationService from "./services/validation.service";
import {rules} from "./services/rules";
import releaseSyncService from "./services/release-sync.service";
import {registerPetriflowSyncRoute} from "./routes/petriflow-sync.route";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info"
  }
});
setLogger(app.log);
validationService.registerRules(rules);
const port = Number(process.env.PORT ?? 3000);
const publicDir = [path.join(__dirname, 'public'), path.join(__dirname, '../public')]
  .find(existsSync)!


app.get("/health", async () => ({status: "ok"}));
app.post("/mcp", xmcpHandler);
app.get("/mcp", xmcpHandler);
registerPetriflowSyncRoute(app);

app.register(fastifyStatic, {
  root: publicDir
})

async function start(): Promise<void> {
  try {
    const report = await releaseSyncService.sync();
    if (report.failedVersions.length > 0) {
      app.log.warn({failedVersions: report.failedVersions}, "Petriflow startup synchronization was incomplete");
    }
  } catch (error) {
    app.log.warn({err: error}, "Petriflow startup synchronization failed; continuing with locally stored releases");
  }

  try {
    const address = await app.listen({port});
    app.log.info("Cache initialized: ");
    app.log.info(cache.status());
    app.log.info(`Server running at ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exitCode = 1;
  }
}

void start();

export default app;
