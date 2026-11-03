/** Return a loopback default for local runs; deployments may opt into a public bind. */
export function getServerHost(env: {HOST?: string} = process.env): string {
  return env.HOST?.trim() || "127.0.0.1";
}

export type PetriflowMode = "LOCAL" | "REMOTE";

/**
 * Select whether Petriflow data comes from the bundled snapshot or release synchronization.
 * LOCAL is the default while the upstream release archives are not published yet.
 */
export function getPetriflowMode(env: {PETRIFLOW_MODE?: string} = process.env): PetriflowMode {
  const mode = env.PETRIFLOW_MODE?.trim().toUpperCase();
  if (!mode) return "LOCAL";
  if (mode === "LOCAL" || mode === "REMOTE") return mode;
  throw new Error("PETRIFLOW_MODE must be LOCAL or REMOTE");
}
