const REGISTRY_SYMBOL = Symbol.for("netgrif.petriflow.ai.services");

type RegistryGlobal = typeof globalThis & {[key: symbol]: unknown};

function getProcessRegistry(): Map<string, unknown> {
  const globalWithRegistry = globalThis as RegistryGlobal;
  const current = globalWithRegistry[REGISTRY_SYMBOL];
  if (current instanceof Map) return current as Map<string, unknown>;

  const registry = new Map<string, unknown>();
  globalWithRegistry[REGISTRY_SYMBOL] = registry;
  return registry;
}

/** Returns one lazily created instance per key across bundled module graphs in this Node.js realm. */
export function getSingleton<T>(key: string, factory: () => T): T {
  const registry = getProcessRegistry();
  if (registry.has(key)) return registry.get(key) as T;

  const instance = factory();
  registry.set(key, instance);
  return instance;
}
