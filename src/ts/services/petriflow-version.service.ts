import releaseSyncService, {type PetriflowVersion, type ReleaseSyncService} from "./release-sync.service";
import type {SnapshotManifest} from "./petriflow-snapshot.service";

export interface PetriflowVersionCatalog {
  listVersions(): PetriflowVersion[];
  getLatestVersion(): string;
  resolveVersion(version: string): string;
}

type RemoteVersionProvider = Pick<ReleaseSyncService, "listVersions" | "getLatestVersion">;

export class PetriflowVersionService implements PetriflowVersionCatalog {
  private localVersion: PetriflowVersion | null = null;

  constructor(private readonly remote: RemoteVersionProvider = releaseSyncService) {}

  useRemote(): void {
    this.localVersion = null;
  }

  useLocal(manifest: SnapshotManifest): void {
    this.localVersion = {
      version: manifest.version,
      releaseDate: manifest.releaseDate,
      prerelease: false,
      latest: true,
    };
  }

  listVersions(): PetriflowVersion[] {
    return this.localVersion ? [{...this.localVersion}] : this.remote.listVersions();
  }

  getLatestVersion(): string {
    return this.localVersion?.version ?? this.remote.getLatestVersion();
  }

  resolveVersion(version: string): string {
    if (version === "latest") return this.getLatestVersion();
    if (this.localVersion && version !== this.localVersion.version) {
      throw new Error(`Petriflow version ${version} is unavailable in LOCAL mode; only ${this.localVersion.version} is bundled`);
    }
    return version;
  }
}

const petriflowVersionService = new PetriflowVersionService();
export default petriflowVersionService;
