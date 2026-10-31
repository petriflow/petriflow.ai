export interface FeatureFlagEnvironment {
  PETRIFLOW_DISABLED_RULES?: string;
  PETRIFLOW_DISABLED_TOOLS?: string;
}

export interface FeatureFlags {
  isRuleEnabled(name: string): boolean;
  isToolEnabled(name: string): boolean;
  unknownRuleNames(knownNames: readonly string[]): string[];
  unknownToolNames(knownNames: readonly string[]): string[];
}

/** Tool ids exposed by the XMCP tool metadata. Keep this in sync with tool metadata names. */
export const knownToolNames = [
  "get_schema",
  "get_action",
  "list_actions",
  "get_example",
  "get_overview",
  "list_examples",
  "list_versions",
  "validate_process",
  "list_elements",
  "get_element",
  "get_component",
  "validate_action",
  "list_components"
] as const;

function parseDisabledNames(value?: string): Set<string> {
  return new Set((value ?? "").split(",").map(name => name.trim()).filter(Boolean));
}

function unknownNames(disabledNames: ReadonlySet<string>, knownNames: readonly string[]): string[] {
  const known = new Set(knownNames);
  return [...disabledNames].filter(name => !known.has(name));
}

/** Build an environment-backed feature-flag view; unset names remain enabled. */
export function createFeatureFlags(env: FeatureFlagEnvironment = process.env): FeatureFlags {
  const disabledRules = parseDisabledNames(env.PETRIFLOW_DISABLED_RULES);
  const disabledTools = parseDisabledNames(env.PETRIFLOW_DISABLED_TOOLS);

  return {
    isRuleEnabled: name => !disabledRules.has(name),
    isToolEnabled: name => !disabledTools.has(name),
    unknownRuleNames: knownNames => unknownNames(disabledRules, knownNames),
    unknownToolNames: knownNames => unknownNames(disabledTools, knownNames)
  };
}

/** Read startup flags once so all tools and validation registration share the same configuration. */
export const featureFlags = createFeatureFlags();

/** Add XMCP's runtime gate while preserving the rest of a tool's metadata. */
export function withToolFeatureFlag<T extends {name: string}>(
  metadata: T,
  flags: Pick<FeatureFlags, "isToolEnabled"> = featureFlags
): T & {enabled: boolean} {
  return {...metadata, enabled: flags.isToolEnabled(metadata.name)};
}
