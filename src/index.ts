import Fastify from "fastify";
import {xmcpHandler} from "@xmcp/adapter";
import {fastifyStatic} from "@fastify/static";
import path from "node:path";
import {existsSync} from "node:fs";
import cache from "./services/cache.service";
import {setLogger, logger} from "./services/logger.service";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info"
  }
});
setLogger(app.log);
const port = Number(process.env.PORT ?? 3000);
const publicDir = [path.join(__dirname, 'public'), path.join(__dirname, '../public')]
  .find(existsSync)!


app.get("/health", async () => ({status: "ok"}));
app.post("/mcp", xmcpHandler);
app.get("/mcp", xmcpHandler);

app.register(fastifyStatic, {
  root: publicDir
})

app.listen({port}, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }

  app.log.info("Cache initialized: ");
  app.log.info(cache.status());

  app.log.info(`Server running at ${address}`);
});

export default app;
