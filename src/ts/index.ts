import Fastify from "fastify";
import {xmcpHandler} from "@xmcp/adapter";
import {fastifyStatic} from "@fastify/static";
import path from "node:path";
import {existsSync} from "node:fs";
import cache from "./services/cache.service";
import {setLogger} from "./services/logger.service";
import validationService from "./services/validation.service";
import {rules} from "./services/rules";
import releaseSyncService from "./services/release-sync.service";
import petriflowSnapshotService from "./services/petriflow-snapshot.service";
import petriflowVersionService from "./services/petriflow-version.service";
import {PetriflowRuntimeService} from "./services/petriflow-runtime.service";
import {registerPetriflowSyncRoute} from "./routes/petriflow-sync.route";
import {getPetriflowMode, getServerHost} from "./services/server-config.service";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info"
  }
});
setLogger(app.log);
validationService.registerRules(rules);
const port = Number(process.env.PORT ?? 3000);
const host = getServerHost();
const petriflowMode = getPetriflowMode();
const petriflowRuntimeService = new PetriflowRuntimeService(
  petriflowSnapshotService,
  petriflowVersionService,
  releaseSyncService,
  (context, message) => app.log.warn(context, message),
);
const publicDir = [path.join(__dirname, 'public'), path.join(__dirname, '../public')]
  .find(existsSync)!


app.get("/health", async () => ({status: "ok"}));
app.post("/mcp", xmcpHandler);
app.get("/mcp", xmcpHandler);
registerPetriflowSyncRoute(app, releaseSyncService, {syncEnabled: petriflowMode === "REMOTE"});

app.register(fastifyStatic, {
  root: publicDir
})

async function start(): Promise<void> {
  try {
    await petriflowRuntimeService.initialize(petriflowMode);
  } catch (error) {
    app.log.error({err: error}, "Petriflow data initialization failed; server will not start");
    process.exitCode = 1;
    return;
  }

  try {
    const address = await app.listen({port, host});
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
