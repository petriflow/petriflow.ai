import {spawn, ChildProcessWithoutNullStreams} from "node:child_process";
import {existsSync} from "node:fs";
import path from "node:path";
import {getLogger} from "./logger.service";
import {getSingleton} from "./singleton-registry.service";

/**
 * Validation of a single Petriflow action (a Groovy code snippet).
 *
 * The action code is validated by compiling it (compile-only, never executed)
 * against a stripped `ActionDelegate` that exposes the full Petriflow DSL
 * method surface. Compilation happens in a persistent Groovy daemon process to
 * avoid paying JVM startup cost on every call.
 */

export type ActionValidationSeverity = "error" | "warning";

export interface ActionValidationIssue {
  /** Identifier of the check that produced the issue (currently "compile"). */
  rule: string;
  severity: ActionValidationSeverity;
  message: string;
  /** 1-based line number in the action source, when available. */
  line?: number;
  /** 1-based column number in the action source, when available. */
  column?: number;
}

export interface ActionValidationResult {
  valid: boolean;
  issues: ActionValidationIssue[];
}

/** A process-scoped `<function>` definition (name + closure body). */
export interface CompiledFunction {
  name: string;
  body: string;
}

/**
 * Matches a Petriflow field/transition reference of the form
 *   name: f.fieldId;   or   name: t.transitionId;
 * (also the comma-separated multi-reference form). The `f`/`t` accessor is
 * used only for Petriflow references, so it is safe to rewrite them to typed
 * local declarations that static compilation can resolve.
 */
const FIELD_REF_RE = /(\w+)\s*:\s*([ft])\.\w+\s*[,;]?/g;

/**
 * Matches a single field/transition identifier reference in a label.
 * Used to extract the referenced ids for the field-existence check.
 */
const FIELD_REF_ID_RE = /(\w+)\s*:\s*([ft])\.(\w+)/g;

/** A parsed field/transition reference: `{name, kind, id}`. */
export interface FieldReference {
  /** The local variable name declared by the label. */
  name: string;
  /** `"f"` (field) or `"t"` (transition). */
  kind: "f" | "t";
  /** The referenced field/transition id. */
  id: string;
}

/**
 * Extracts all field/transition references from an action source, returning
 * `{name, kind, id}` for each. Used by the action-validation rule to check that
 * referenced ids exist in the process.
 */
export function extractFieldRefs(source: string): FieldReference[] {
  const refs: FieldReference[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(FIELD_REF_ID_RE.source, "g");
  while ((match = re.exec(source)) !== null) {
    refs.push({name: match[1], kind: match[2] as "f" | "t", id: match[3]});
  }
  return refs;
}

/**
 * Rewrites Petriflow field/transition references into typed local variables:
 *   c_active: f.c_active;   ->   Field c_active = null
 *   transition: t.transitionId; -> Transition transition = null
 */
export function normalizeFieldRefs(source: string): string {
  return source.replace(FIELD_REF_RE, (_match, name: string, accessor: string) => {
    const type = accessor === "f" ? "Field" : "Transition";
    return `${type} ${name} = null\n`;
  });
}

/** Resolves the directory containing the Groovy validator and its library. */
function findGroovyDir(): string {
  const candidates = [
    path.join(__dirname, "groovy"),        // dist/groovy (bundled)
    path.join(__dirname, "../../groovy"),  // src/groovy (dev, from src/ts/services)
    path.join(process.cwd(), "src/groovy"),
  ];
  const found = candidates.find((p) => existsSync(path.join(p, "Validator.groovy")));
  if (!found) {
    throw new Error("Groovy validator not found. Expected src/groovy/Validator.groovy next to the server bundle.");
  }
  return found;
}

interface PendingRequest {
  resolve: (result: ActionValidationResult) => void;
  reject: (err: Error) => void;
}

export class ActionValidationService {
  private _daemon: ChildProcessWithoutNullStreams | null = null;
  private _queue: PendingRequest[] = [];
  private _buffer = "";
  private _starting: Promise<void> | null = null;

  /**
   * Validates a single action definition (Groovy code). Field references are
   * normalized before being sent to the Groovy compiler.
   */
  async validate(definition: string): Promise<ActionValidationResult> {
    const normalized = normalizeFieldRefs(definition);
    return this._request({source: normalized});
  }

  /**
   * Validates an action with an associated set of process-scoped `<function>`
   * definitions. The functions are injected so bare (non-DSL) calls in the
   * action resolve against them.
   *
   * The `definition` must already be normalized (field references rewritten to
   * typed declarations) — the caller is responsible for that.
   */
  async validateWithFunctions(
    definition: string,
    functions: CompiledFunction[] = []
  ): Promise<ActionValidationResult> {
    return this._request({source: definition, functions});
  }

  /**
   * Validates a single `<function>` body (a Groovy closure) in isolation.
   */
  async validateFunction(body: string): Promise<ActionValidationResult> {
    return this._request({function: body});
  }

  private async _request(request: Record<string, unknown>): Promise<ActionValidationResult> {
    await this._ensureDaemon();
    const daemon = this._daemon!;

    return new Promise<ActionValidationResult>((resolve, reject) => {
      this._queue.push({resolve, reject});
      daemon.stdin.write(JSON.stringify(request) + "\n");
    });
  }

  private async _ensureDaemon(): Promise<void> {
    if (this._daemon && !this._daemon.killed) {
      return;
    }
    if (this._starting) {
      return this._starting;
    }
    this._starting = this._spawn();
    await this._starting;
    this._starting = null;
  }

  private _spawn(): Promise<void> {
    return new Promise((resolve, reject) => {
      const groovyDir = findGroovyDir();
      const validatorPath = path.join(groovyDir, "Validator.groovy");

      getLogger().info(`Starting Groovy action validator daemon: groovy ${validatorPath}`);
      const daemon = spawn("groovy", [validatorPath], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      this._daemon = daemon;
      this._buffer = "";

      daemon.stdout.on("data", (chunk: Buffer) => this._onData(chunk.toString()));
      daemon.stderr.on("data", (chunk: Buffer) => {
        getLogger().warn(`[groovy-validator] ${chunk.toString().trim()}`);
      });
      daemon.on("error", (err) => {
        getLogger().error(`Groovy validator daemon error: ${err.message}`);
        this._failAll(err);
        this._daemon = null;
      });
      daemon.on("exit", (code) => {
        getLogger().warn(`Groovy validator daemon exited with code ${code}`);
        this._failAll(new Error(`Groovy validator daemon exited (code ${code})`));
        this._daemon = null;
      });

      // Consider the daemon ready once it has spawned without an immediate error.
      daemon.once("spawn", () => resolve());
    });
  }

  private _onData(data: string): void {
    this._buffer += data;
    let newlineIndex: number;
    while ((newlineIndex = this._buffer.indexOf("\n")) !== -1) {
      const line = this._buffer.slice(0, newlineIndex).trim();
      this._buffer = this._buffer.slice(newlineIndex + 1);
      if (!line) {
        continue;
      }
      this._handleResponse(line);
    }
  }

  private _handleResponse(line: string): void {
    const pending = this._queue.shift();
    if (!pending) {
      getLogger().warn(`[groovy-validator] Unexpected response with no pending request: ${line}`);
      return;
    }
    try {
      const parsed = JSON.parse(line);
      const result: ActionValidationResult = {
        valid: parsed.ok === true,
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      };
      pending.resolve(result);
    } catch (err) {
      pending.reject(new Error(`Invalid response from Groovy validator: ${line}`));
    }
  }

  private _failAll(err: Error): void {
    const queue = this._queue;
    this._queue = [];
    for (const pending of queue) {
      pending.reject(err);
    }
  }
}

const actionValidationService = getSingleton(
  "netgrif.petriflow.ai/action-validation",
  () => new ActionValidationService(),
);
export default actionValidationService;
