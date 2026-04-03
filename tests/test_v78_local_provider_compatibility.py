from pathlib import Path

from core.schemas import GraphPayload
from core.compiler import _build_context


def make_payload(provider: str, base_url: str):
    return GraphPayload(
        graph_id='compat_graph',
        nodes=[{
            'id': 'llm_1',
            'type': 'llm_chat',
            'params': {
                'provider': provider,
                'model_name': 'local-model',
                'api_base_url': base_url,
                'temperature': 0.1,
            },
        }],
        edges=[],
        tools=[],
    )


def test_schema_accepts_local_openai_compatible_provider_values():
    for provider in ['openai_compat', 'lm_studio', 'llama_cpp', 'lmstudio', 'llama.cpp']:
        payload = make_payload(provider, 'http://127.0.0.1:1234/v1')
        assert payload.nodes[0].params.provider in {'openai_compat', 'lm_studio', 'llama_cpp'}


def test_render_context_treats_local_openai_compatible_providers_as_openai_family():
    for provider in ['openai_compat', 'lm_studio', 'llama_cpp']:
        ctx = _build_context(make_payload(provider, 'http://127.0.0.1:1234/v1'))
        assert ctx['has_openai'] is True


def test_llm_template_contains_openai_compatible_adapter_logic():
    text = Path('templates/nodes.py.jinja').read_text()
    assert 'OPENAI_COMPAT_PROVIDER_FAMILIES' in text
    assert 'api_base_url' in text
    assert 'ChatOpenAI' in text


def test_tool_template_contains_openai_compatible_adapter_logic_for_subagents_and_workers():
    text = Path('templates/tools.py.jinja').read_text()
    assert '_build_chat_model' in text
    assert 'api_base_url' in text
    assert 'ChatOpenAI' in text


def test_frontend_exposes_local_provider_options_and_base_url():
    text = Path('client/src/nodeConfig.ts').read_text()
    assert "'LM Studio'" in text
    assert "'llama.cpp server'" in text
    assert "'OpenAI-compatible'" in text
    assert "'API Base URL'" in text
