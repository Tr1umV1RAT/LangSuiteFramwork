from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

_PROVIDER_CONTRACTS_PATH = Path(__file__).resolve().parent.parent / 'client' / 'src' / 'contracts' / 'providerContracts.json'


@lru_cache(maxsize=1)
def load_provider_contracts() -> dict[str, Any]:
    with _PROVIDER_CONTRACTS_PATH.open('r', encoding='utf-8') as fh:
        data = json.load(fh)
    if not isinstance(data, dict):
        raise ValueError('provider contracts must be a JSON object')
    return data


@lru_cache(maxsize=1)
def provider_meta() -> dict[str, dict[str, Any]]:
    raw = load_provider_contracts().get('providers', {})
    if not isinstance(raw, dict):
        raise ValueError('provider contracts.providers must be a mapping')
    return {str(key): value for key, value in raw.items() if isinstance(value, dict)}


@lru_cache(maxsize=1)
def provider_aliases() -> dict[str, str]:
    aliases: dict[str, str] = {}
    for provider, meta in provider_meta().items():
        aliases[provider] = provider
        for alias in meta.get('aliases') or []:
            aliases[str(alias).strip().lower()] = provider
    return aliases


@lru_cache(maxsize=1)
def normalize_provider(provider: str | None) -> str:
    raw = str(provider or '').strip().lower()
    if not raw:
        return ''
    return provider_aliases().get(raw, raw)


@lru_cache(maxsize=1)
def known_providers() -> tuple[str, ...]:
    return tuple(provider_meta().keys())


@lru_cache(maxsize=1)
def selectable_provider_options() -> list[dict[str, str]]:
    return [
        {'label': str(meta.get('label') or provider), 'value': provider}
        for provider, meta in provider_meta().items()
        if bool(meta.get('uiSelectable', True))
    ]


@lru_cache(maxsize=1)
def provider_requires_api_key_env(provider: str | None) -> bool:
    meta = provider_meta().get(normalize_provider(provider), {})
    return bool(meta.get('requiresApiKeyEnv'))


@lru_cache(maxsize=1)
def provider_default_api_key_env(provider: str | None) -> str:
    meta = provider_meta().get(normalize_provider(provider), {})
    return str(meta.get('defaultApiKeyEnv') or '')


@lru_cache(maxsize=1)
def provider_requires_api_base_url(provider: str | None) -> bool:
    meta = provider_meta().get(normalize_provider(provider), {})
    return bool(meta.get('requiresApiBaseUrl'))


@lru_cache(maxsize=1)
def provider_default_api_base_url(provider: str | None) -> str:
    meta = provider_meta().get(normalize_provider(provider), {})
    return str(meta.get('defaultApiBaseUrl') or '')


@lru_cache(maxsize=1)
def provider_runtime_requirement(provider: str | None) -> tuple[str, str, str] | None:
    normalized = normalize_provider(provider)
    meta = provider_meta().get(normalized)
    if not meta:
        return None
    module_name = str(meta.get('runtimeModule') or '').strip()
    pip_name = str(meta.get('runtimePackage') or '').strip()
    label = str(meta.get('label') or normalized).strip() or normalized
    if not module_name or not pip_name:
        return None
    return module_name, pip_name, f'{label} provider-backed chat models'


@lru_cache(maxsize=1)
def provider_is_embedded_native_allowed(provider: str | None) -> bool:
    meta = provider_meta().get(normalize_provider(provider), {})
    return bool(meta.get('embeddedNativeAllowed'))


@lru_cache(maxsize=1)
def provider_is_ui_selectable(provider: str | None) -> bool:
    meta = provider_meta().get(normalize_provider(provider), {})
    return bool(meta.get('uiSelectable', True))


@lru_cache(maxsize=1)
def provider_unsupported_reason(provider: str | None) -> str:
    meta = provider_meta().get(normalize_provider(provider), {})
    return str(meta.get('unsupportedReason') or '')


@lru_cache(maxsize=1)
def openai_compatible_provider_families() -> tuple[str, ...]:
    values = []
    for provider, meta in provider_meta().items():
        if str(meta.get('adapter') or '') == 'langchain_openai' and bool(meta.get('requiresApiBaseUrl')):
            values.append(provider)
    return tuple(values)


@lru_cache(maxsize=1)
def provider_env_var_map() -> dict[str, str]:
    mapping: dict[str, str] = {}
    for provider, meta in provider_meta().items():
        env_name = str(meta.get('defaultApiKeyEnv') or '').strip()
        if env_name:
            mapping[provider] = env_name
    return mapping
