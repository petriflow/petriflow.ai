import type {FastifyInstance} from "fastify";
import releaseSyncService, {type ReleaseSyncService} from "../services/release-sync.service";

export function registerPetriflowSyncRoute(
  app: FastifyInstance,
  service: Pick<ReleaseSyncService, "sync"> = releaseSyncService,
): void {
  app.post("/admin/petriflow/sync", async (_request, reply) => {
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
