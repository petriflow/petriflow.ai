import path from "node:path";
import {strToU8, zipSync} from "fflate";
import {parseXml, type Element} from "libxmljs5";
import {generateAppManifest, type AppManifestMetadata} from "./app-manifest.service";

export const PACKAGE_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,
  maxProcesses: 100,
  maxPackageBytes: 50 * 1024 * 1024,
  maxFieldBytes: 16 * 1024,
  maxBatches: 10,
  maxRetainedBytes: 200 * 1024 * 1024,
  batchTtlMs: 30 * 60 * 1000,
} as const;

export type PackageStatusCode = 400 | 404 | 409 | 413 | 503;

export class PackageError extends Error {
  constructor(message: string, readonly statusCode: PackageStatusCode = 400) {
    super(message);
    this.name = "PackageError";
  }
}

export interface ProcessXmlFile {
  name: string;
  id: string;
  content: Buffer;
}

export interface ApplicationPackage {
  archive: Buffer;
  manifestXml: string;
  processIds: string[];
}

export interface ApplicationManifest {
  xml: string;
  content: Buffer;
}

export interface ApplicationPackageInput {
  manifest?: ApplicationManifest;
  metadata?: AppManifestMetadata;
  processes: ProcessXmlFile[];
}

export interface ApplicationPackageLimits {
  maxPackageBytes: number;
}

const XML_OPTIONS = {noent: false, dtdload: false, nonet: true} as const;

/** Reduce an uploaded filename to a safe ZIP entry name. */
export function sanitizeFileName(filename: string): string {
  const base = path.posix.basename(filename.replace(/\\/g, "/")).trim();
  if (!base || base === "." || base === "..") {
    throw new PackageError(`Invalid file name: ${filename}`, 400);
  }
  return base;
}

function decodeXml(content: Buffer, description: string): string {
  if ((content[0] === 0xff && content[1] === 0xfe) || (content[0] === 0xfe && content[1] === 0xff)) {
    throw new PackageError(`UTF-16 XML is not supported in ${description}; save it as UTF-8`, 400);
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", {fatal: true}).decode(content);
  } catch {
    throw new PackageError(`XML in ${description} must be UTF-8`, 400);
  }
  text = text.replace(/^\uFEFF/, "");

  const declared = /^<\?xml[^>]*encoding=["']([^"']+)["']/i.exec(text)?.[1];
  if (declared && !/^utf-?8$/i.test(declared)) {
    throw new PackageError(`Unsupported XML encoding ${declared} in ${description}; save it as UTF-8`, 400);
  }

  return text;
}

function parseDocument(text: string, description: string) {
  try {
    return parseXml(text, XML_OPTIONS);
  } catch {
    throw new PackageError(`Invalid XML in ${description}`, 400);
  }
}

/** Parses a process XML, rejects non-Petriflow names and extracts its id. */
export function parseProcessXml(filename: string, content: Buffer): ProcessXmlFile {
  const name = sanitizeFileName(filename);
  if (!name.toLowerCase().endsWith(".xml")) {
    throw new PackageError(`Only .xml files are accepted: ${name}`, 400);
  }
  if (name.toLowerCase() === "manifest.xml") {
    throw new PackageError("manifest.xml must be sent as the manifest, not as a process", 400);
  }

  const text = decodeXml(content, name);
  if (!text.trim()) {
    throw new PackageError(`Empty XML file: ${name}`, 400);
  }

  const doc = parseDocument(text, name);
  if (doc.root()?.name() !== "document") {
    throw new PackageError(`Process XML ${name} must have a <document> root`, 400);
  }

  const id = doc.get<Element>("/document/id")?.text().trim() ?? "";
  if (!id) {
    throw new PackageError(`Process XML ${name} has no <id>`, 400);
  }

  return {name, id, content};
}

/** Parses a provided manifest and requires the NAE application root element. */
export function parseManifestXml(content: Buffer): ApplicationManifest {
  const text = decodeXml(content, "manifest.xml");
  if (!text.trim()) {
    throw new PackageError("Empty manifest.xml", 400);
  }

  const doc = parseDocument(text, "manifest.xml");
  if (doc.root()?.name() !== "cases") {
    throw new PackageError("manifest.xml must have a <cases> root", 400);
  }

  return {xml: text, content};
}

function uniqueProcessIds(processes: ProcessXmlFile[]): string[] {
  const ids = new Set<string>();
  const names = new Set<string>();

  for (const process of processes) {
    if (ids.has(process.id)) {
      throw new PackageError(`Duplicate process id: ${process.id}`, 409);
    }
    if (names.has(process.name)) {
      throw new PackageError(`Duplicate process file name: ${process.name}`, 409);
    }
    ids.add(process.id);
    names.add(process.name);
  }

  return [...ids];
}

/** Builds the application ZIP from a provided or generated manifest. */
export function buildApplicationPackage(
  input: ApplicationPackageInput,
  limits: ApplicationPackageLimits = PACKAGE_LIMITS,
): ApplicationPackage {
  if (input.processes.length === 0) {
    throw new PackageError("At least one process XML file is required", 400);
  }

  const processIds = uniqueProcessIds(input.processes);

  let manifestXml: string;
  let manifestContent: Buffer;
  if (input.manifest) {
    manifestXml = input.manifest.xml;
    manifestContent = input.manifest.content;
  } else if (input.metadata) {
    manifestXml = generateAppManifest({...input.metadata, processes: processIds});
    manifestContent = Buffer.from(strToU8(manifestXml));
  } else {
    throw new PackageError("Manifest metadata is required when manifest.xml is not uploaded", 400);
  }

  const totalBytes = manifestContent.length +
    input.processes.reduce((sum, process) => sum + process.content.length, 0);
  if (totalBytes > limits.maxPackageBytes) {
    throw new PackageError("Application package exceeds the size limit", 413);
  }

  const entries: Record<string, Uint8Array> = {
    "manifest.xml": new Uint8Array(manifestContent),
  };
  for (const process of input.processes) {
    entries[`processes/${process.name}`] = new Uint8Array(process.content);
  }

  return {
    archive: Buffer.from(zipSync(entries, {level: 6})),
    manifestXml,
    processIds,
  };
}
