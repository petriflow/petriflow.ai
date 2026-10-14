import type {ReleaseSyncService, SyncReport} from "./release-sync.service";
import type {PetriflowSnapshotService} from "./petriflow-snapshot.service";
import type {PetriflowVersionService} from "./petriflow-version.service";
import type {PetriflowMode} from "./server-config.service";

type SnapshotInstaller = Pick<PetriflowSnapshotService, "install">;
type VersionSelector = Pick<PetriflowVersionService, "useLocal" | "useRemote">;
type ReleaseSynchronizer = Pick<ReleaseSyncService, "sync">;
type StartupWarning = (context: Record<string, unknown>, message: string) => void;

export class PetriflowRuntimeService {
  constructor(
    private readonly snapshot: SnapshotInstaller,
    private readonly versions: VersionSelector,
    private readonly synchronizer: ReleaseSynchronizer,
    private readonly warn: StartupWarning,
  ) {}

  async initialize(mode: PetriflowMode): Promise<void> {
    if (mode === "LOCAL") {
      const manifest = this.snapshot.install();
      this.versions.useLocal(manifest);
      return;
    }

    this.versions.useRemote();
    try {
      const report: SyncReport = await this.synchronizer.sync();
      if (report.failedVersions.length > 0) {
        this.warn(
          {failedVersions: report.failedVersions},
          "Petriflow startup synchronization was incomplete",
        );
      }
    } catch (error) {
      this.warn(
        {err: error},
        "Petriflow startup synchronization failed; continuing with locally stored releases",
      );
    }
  }
}
