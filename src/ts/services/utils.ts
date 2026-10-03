// --- Utilities functions ---

import cache from "./cache.service";
import path from "node:path";
import fs from "node:fs";

export function getLatestVersion(): string {
  const version = cache.get("latestVersion");
  if (!version) {
    throw new Error("Latest version not found. Please specify exact version. Call tool list-versions first");
  }
  return version;
}

export function getVersionedPath(version: string, suffix: string[] = [], prefix: string[] = ["public"]): string {
  let versioned = path.join(__dirname, ...prefix, "v" + version, ...suffix);
  if (!fs.existsSync(versioned)) {
    versioned = path.join(__dirname, ...prefix, "fallback", ...suffix);
    if (!fs.existsSync(versioned))
      throw new Error(`Content on path ${versioned} does not exist`);
  }
  return versioned;
}
