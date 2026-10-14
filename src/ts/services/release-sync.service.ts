import {unzipSync} from "fflate";
import {rcompare, valid} from "semver";
import storage, {StorageService} from "./storage.service";
import cache from "./cache.service";
import {logger} from "./logger.service";
import {validateReleaseFiles} from "./release-files.service";

const RELEASES_URL = "https://api.github.com/repos/petriflow/petriflow/releases";

export interface PetriflowVersion {
  version: string;
  releaseDate: string;
  prerelease: boolean;
  latest: boolean;
}

export interface FailedRelease {
  version: string;
  message: string;
}

export interface SyncReport {
  discoveredVersions: number;
  downloadedVersions: string[];
  alreadyInstalledVersions: string[];
  failedVersions: FailedRelease[];
}

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at?: string | null;
  created_at?: string | null;
  assets: ReleaseAsset[];
}

interface CacheStore {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

interface ReleaseSyncOptions {
  fetcher?: typeof fetch;
  storage?: StorageService;
  cache?: CacheStore;
}

export class ReleaseSyncService {
  private readonly fetcher: typeof fetch;
  private readonly storage: StorageService;
  private readonly cache: CacheStore;
  private inFlight: Promise<SyncReport> | null = null;

  constructor(options: ReleaseSyncOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.storage = options.storage ?? storage;
    this.cache = options.cache ?? cache;
  }

  /** Synchronizes release metadata and installs all missing published assets. */
  sync(): Promise<SyncReport> {
    if (!this.inFlight) {
      this.inFlight = this.syncReleases().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  listVersions(): PetriflowVersion[] {
    const versions = this.cache.get("versions");
    return Array.isArray(versions) ? versions as PetriflowVersion[] : [];
  }

  getLatestVersion(): string {
    const version = this.cache.get("latestVersion");
    if (typeof version !== "string" || !version) {
      throw new Error("Latest version not found. Run release synchronization first.");
    }
    return version;
  }

  private async syncReleases(): Promise<SyncReport> {
    const releases = await this.fetchReleases();
    const versions = this.toVersions(releases);
    this.cache.set("versions", versions);
    this.cache.set("latestVersion", versions.find((version) => version.latest)?.version ?? null);

    const report: SyncReport = {
      discoveredVersions: versions.length,
      downloadedVersions: [],
      alreadyInstalledVersions: [],
      failedVersions: [],
    };
    const seen = new Set<string>();

    for (const release of releases) {
      if (release.draft) continue;
      const version = release.tag_name.replace(/^v/, "");
      if (seen.has(version)) continue;
      seen.add(version);

      if (!valid(version)) {
        report.failedVersions.push({version, message: `Invalid SemVer release tag: ${release.tag_name}`});
        continue;
      }
      if (this.storage.hasVersion(version)) {
        report.alreadyInstalledVersions.push(version);
        continue;
      }

      try {
        const installed = await this.installRelease(release, version);
        if (installed) report.downloadedVersions.push(version);
        else report.alreadyInstalledVersions.push(version);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        report.failedVersions.push({version, message});
        logger.warn(`Failed to install Petriflow ${version}: ${message}`);
      }
    }

    logger.info({
      discoveredVersions: report.discoveredVersions,
      downloadedVersions: report.downloadedVersions,
      alreadyInstalledVersions: report.alreadyInstalledVersions,
      failedVersions: report.failedVersions,
    }, "Petriflow release synchronization complete");
    return report;
  }

  private async fetchReleases(): Promise<GitHubRelease[]> {
    const releases: GitHubRelease[] = [];
    for (let page = 1; ; page++) {
      const response = await this.fetcher(`${RELEASES_URL}?per_page=100&page=${page}`, {
        headers: {
          accept: "application/vnd.github+json",
          "user-agent": "petriflow.ai",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch Petriflow releases: ${response.status} ${response.statusText}`);
      }

      const batch: unknown = await response.json();
      if (!Array.isArray(batch)) {
        throw new Error("Invalid response while fetching Petriflow releases");
      }
      releases.push(...batch as GitHubRelease[]);
      if (batch.length < 100) return releases;
    }
  }

  private toVersions(releases: GitHubRelease[]): PetriflowVersion[] {
    const latest = releases
      .filter((release) => !release.prerelease && !release.draft)
      .map((release) => release.tag_name.replace(/^v/, ""))
      .filter((version) => valid(version) !== null)
      .sort(rcompare)[0] ?? null;

    return releases.map((release) => {
      const version = release.tag_name.replace(/^v/, "");
      return {
        version,
        releaseDate: release.published_at ?? release.created_at ?? "",
        prerelease: release.prerelease || release.draft,
        latest: latest !== null && version === latest,
      };
    });
  }

  private async installRelease(release: GitHubRelease, version: string): Promise<boolean> {
    const assetName = `petriflow-v${version}.zip`;
    const asset = release.assets?.find((candidate) => candidate.name === assetName);
    if (!asset) {
      throw new Error(`Release asset ${assetName} not found`);
    }

    const assetUrl = new URL(asset.browser_download_url);
    if (assetUrl.protocol !== "https:" || assetUrl.hostname !== "github.com") {
      throw new Error(`Release asset URL must be an HTTPS github.com URL: ${asset.browser_download_url}`);
    }

    const response = await this.fetcher(assetUrl);
    if (!response.ok) {
      throw new Error(`Failed to download ${assetName}: ${response.status} ${response.statusText}`);
    }

    const archive = new Uint8Array(await response.arrayBuffer());
    const files = this.extractReleaseFiles(archive);
    validateReleaseFiles(files, assetName);
    return this.storage.installVersion(version, files);
  }

  private extractReleaseFiles(archive: Uint8Array): Record<string, string> {
    const entries = unzipSync(archive);
    const files = Object.create(null) as Record<string, string>;
    const decoder = new TextDecoder("utf-8", {fatal: true});

    for (const [name, contents] of Object.entries(entries)) {
      if (name.endsWith("/")) continue;
      this.assertSafeArchivePath(name);
      files[name] = decoder.decode(contents);
    }
    return files;
  }

  private assertSafeArchivePath(name: string): void {
    const segments = name.split("/");
    if (!name || name.startsWith("/") || name.includes("\\") ||
      segments.some((segment) => segment === "" || segment === "." || segment === "..") ||
      /^[A-Za-z]:/.test(name)) {
      throw new Error(`Unsafe path in release ZIP: ${name}`);
    }
  }

}

const releaseSyncService = new ReleaseSyncService();
export default releaseSyncService;
