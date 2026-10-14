import {spawn, type ChildProcess} from "node:child_process";
import {readFileSync} from "node:fs";
import net from "node:net";
import path from "node:path";
import {expect, test} from "vitest";

interface JsonRpcResponse {
  result?: {
    structuredContent?: {
      versions?: Array<{version: string; latest: boolean}>;
    };
  };
  error?: {message: string};
}

async function getFreePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to reserve a test port");
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function parseRpcResponse(response: Response): Promise<JsonRpcResponse> {
  const body = await response.text();
  if (!response.ok) throw new Error(`MCP request failed (${response.status}): ${body}`);
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const data = body.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
    if (!data) throw new Error(`MCP event stream did not contain a data frame: ${body}`);
    return JSON.parse(data) as JsonRpcResponse;
  }
  return JSON.parse(body) as JsonRpcResponse;
}

function postRpc(url: string, payload: Record<string, unknown>, sessionId?: string): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...(sessionId ? {"mcp-session-id": sessionId} : {}),
      "mcp-protocol-version": "2025-06-18",
    },
    body: JSON.stringify(payload),
  });
}

async function waitForHealth(url: string, child: ChildProcess, output: () => string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (child.exitCode !== null) throw new Error(`MCP server exited early: ${output()}`);
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      // The child is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`MCP server did not become healthy: ${output()}`);
}

test.skipIf(!process.env.PETRIFLOW_TEST_SERVER_PATH)(
  "serves the LOCAL version through the bundled XMCP adapter after startup",
  async () => {
    const serverPath = path.resolve(process.env.PETRIFLOW_TEST_SERVER_PATH!);
    const manifestPath = path.join(path.dirname(serverPath), "petriflow", "snapshot", "manifest.json");
    const {version} = JSON.parse(readFileSync(manifestPath, "utf8")) as {version: string};
    const port = await getFreePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const url = `${baseUrl}/mcp`;
    const child = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: String(port),
        PETRIFLOW_MODE: "LOCAL",
        LOG_LEVEL: "silent",
        NODE_PATH: [process.env.NODE_PATH, path.join(process.cwd(), "node_modules")].filter(Boolean).join(path.delimiter),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout?.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { output += chunk.toString(); });

    try {
      await waitForHealth(baseUrl, child, () => output);
      const initializeResponse = await postRpc(url, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: {name: "singleton-registry-test", version: "1.0.0"},
        },
      });
      const sessionId = initializeResponse.headers.get("mcp-session-id") ?? undefined;
      const initialized = await parseRpcResponse(initializeResponse);
      if (initialized.error) throw new Error(initialized.error.message);

      await postRpc(url, {jsonrpc: "2.0", method: "notifications/initialized"}, sessionId);
      const toolResponse = await parseRpcResponse(await postRpc(url, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {name: "list-versions", arguments: {}},
      }, sessionId));
      if (toolResponse.error) throw new Error(toolResponse.error.message);
      expect(toolResponse.result?.structuredContent?.versions).toEqual([
        {version, releaseDate: expect.any(String), prerelease: false, latest: true},
      ]);

      const syncResponse = await fetch(`${baseUrl}/admin/petriflow/sync`, {method: "POST"});
      expect(syncResponse.status).toBe(409);
    } finally {
      child.kill("SIGTERM");
      await Promise.race([
        new Promise<void>((resolve) => child.once("exit", () => resolve())),
        new Promise<void>((resolve) => setTimeout(resolve, 2000)),
      ]);
    }
  },
);
