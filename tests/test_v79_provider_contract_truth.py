from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.collaboration import _sanitize_session_alias
from core.bridge_lowering import validate_embedded_native_langchain_manifest
from core.provider_contracts import (
    normalize_provider,
    openai_compatible_provider_families,
    provider_default_api_base_url,
    provider_is_ui_selectable,
    provider_requires_api_base_url,
    provider_unsupported_reason,
)
from core.runtime_preflight import find_runtime_preflight_issues
from core.schemas import GraphPayload


def _llm_payload(provider: str, **params):
    merged = {'provider': provider, 'model_name': 'demo-model'}
    merged.update(params)
    return GraphPayload(
        graph_id='provider_truth',
        nodes=[{'id': 'llm_1', 'type': 'llm_chat', 'params': merged}],
        edges=[],
        tools=[],
    )


def test_provider_contract_normalization_and_local_defaults() -> None:
    assert normalize_provider('lmstudio') == 'lm_studio'
    assert normalize_provider('llama.cpp') == 'llama_cpp'
    assert provider_requires_api_base_url('lm_studio') is True
    assert provider_default_api_base_url('llama_cpp') == 'http://127.0.0.1:8080/v1'
    assert set(openai_compatible_provider_families()) >= {'openai_compat', 'lm_studio', 'llama_cpp'}


def test_runtime_preflight_flags_missing_api_base_url_for_local_openai_compatible_surfaces() -> None:
    issues = find_runtime_preflight_issues(_llm_payload('lm_studio'))
    codes = {issue['code'] for issue in issues}
    assert 'missing_provider_api_base_url' in codes


def test_runtime_preflight_rejects_unmodeled_provider_surface() -> None:
    issues = find_runtime_preflight_issues(_llm_payload('azure_openai'))
    codes = {issue['code'] for issue in issues}
    assert provider_is_ui_selectable('azure_openai') is False
    assert provider_unsupported_reason('azure_openai')
    assert 'provider_surface_not_supported' in codes


def test_embedded_native_provider_contract_accepts_local_provider_family_when_modeled() -> None:
    manifest = {
        'kind': 'agent',
        'title': 'Local Provider Agent',
        'artifact': {
            'artifactType': 'agent',
            'executionProfile': 'langchain_async',
            'projectMode': 'langchain',
            'nodes': [
                {
                    'id': 'node_1',
                    'type': 'llm_chat',
                    'data': {
                        'nodeType': 'llm_chat',
                        'params': {
                            'provider': 'llama_cpp',
                            'model_name': 'local-model',
                            'api_base_url': 'http://127.0.0.1:8080/v1',
                        },
                    },
                }
            ],
            'edges': [],
            'tools': [],
        },
    }
    meta = validate_embedded_native_langchain_manifest(manifest)
    assert meta['providerBacked'] is True
    assert 'llama_cpp' in meta['acceptedProviderFamilies']
    assert meta['contractId'] == 'langchain_agent_embedded_v1'


def test_session_alias_sanitizer_keeps_alias_semantics_local_and_bounded() -> None:
    assert _sanitize_session_alias('   Alice   Bob   ') == 'Alice Bob'
    assert _sanitize_session_alias('') == 'Guest'
    assert len(_sanitize_session_alias('x' * 80)) == 32
