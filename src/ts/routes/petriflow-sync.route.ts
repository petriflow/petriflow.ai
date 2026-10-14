import type {FastifyInstance} from "fastify";
import releaseSyncService, {type ReleaseSyncService} from "../services/release-sync.service";

export function registerPetriflowSyncRoute(
  app: FastifyInstance,
  service: Pick<ReleaseSyncService, "sync"> = releaseSyncService,
  options: {syncEnabled?: boolean} = {},
): void {
  app.post("/admin/petriflow/sync", async (_request, reply) => {
    if (options.syncEnabled === false) {
      return reply.code(409).send({
        status: "disabled",
        error: "Petriflow synchronization is disabled in LOCAL mode",
      });
    }

    try {
      const report = await service.sync();
      const partial = report.failedVersions.length > 0;
      return reply.code(partial ? 503 : 200).send({
        status: partial ? "partial" : "synchronized",
        ...report,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(503).send({status: "failed", error: message});
    }
  });
}
