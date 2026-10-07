/** Return a loopback default for local runs; deployments may opt into a public bind. */
export function getServerHost(env: {HOST?: string} = process.env): string {
  return env.HOST?.trim() || "127.0.0.1";
}
