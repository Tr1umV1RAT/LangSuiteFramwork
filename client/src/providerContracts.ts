import rawContracts from './contracts/providerContracts.json';

export type ProviderMeta = {
  label: string;
  aliases?: string[];
  adapter?: string;
  kind?: string;
  requiresApiKeyEnv?: boolean;
  defaultApiKeyEnv?: string;
  requiresApiBaseUrl?: boolean;
  defaultApiBaseUrl?: string;
  runtimeModule?: string;
  runtimePackage?: string;
  embeddedNativeAllowed?: boolean;
  uiSelectable?: boolean;
  unsupportedReason?: string;
};

const providers = (rawContracts.providers ?? {}) as Record<string, ProviderMeta>;

export const PROVIDER_META = providers;
export const KNOWN_PROVIDER_VALUES = new Set(Object.keys(PROVIDER_META));
export const PROVIDER_ALIAS_MAP = new Map<string, string>();

for (const [provider, meta] of Object.entries(PROVIDER_META)) {
  PROVIDER_ALIAS_MAP.set(provider, provider);
  for (const alias of meta.aliases ?? []) {
    PROVIDER_ALIAS_MAP.set(String(alias).trim().toLowerCase(), provider);
  }
}

export function normalizeProvider(provider: unknown): string {
  const raw = typeof provider === 'string' ? provider.trim().toLowerCase() : '';
  if (!raw) return '';
  return PROVIDER_ALIAS_MAP.get(raw) ?? raw;
}

export function getProviderMeta(provider: unknown): ProviderMeta | null {
  const normalized = normalizeProvider(provider);
  return normalized ? (PROVIDER_META[normalized] ?? null) : null;
}

export const SELECTABLE_PROVIDER_OPTIONS = Object.entries(PROVIDER_META)
  .filter(([, meta]) => meta.uiSelectable !== false)
  .map(([value, meta]) => ({ label: meta.label || value, value }));

export const LOCAL_OPENAI_COMPAT_PROVIDER_VALUES = new Set(
  Object.entries(PROVIDER_META)
    .filter(([, meta]) => meta.requiresApiBaseUrl)
    .map(([provider]) => provider),
);

export const CLOUD_PROVIDER_API_KEYS = new Set(
  Object.entries(PROVIDER_META)
    .filter(([, meta]) => meta.requiresApiKeyEnv)
    .map(([provider]) => provider),
);
