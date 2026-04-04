from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.artifact_registry import get_artifact


FORBIDDEN_MODULE_KEYS = {
    'runtimeRail',
    'compilerRail',
    'persistenceRail',
    'jdrRuntimeProfile',
    'branchCompiler',
    'branchPersistence',
}


def _starter_runtime() -> dict:
    manifest = get_artifact('graph', 'jdr_solo_session_starter')
    assert manifest is not None
    return manifest['artifact']['runtimeSettings']


def test_jdr_modules_remain_bounded_branch_overlays() -> None:
    runtime = _starter_runtime()
    module_library = runtime['moduleLibrary']
    assert module_library, 'starter should keep its JDR packs in the bounded module library'
    for entry in module_library:
        assert entry['category'] in {'world', 'rules', 'persona', 'party', 'utility', 'mixed'}
        assert entry['lineage'] in {'shared', 'branch_overlay'}
        assert set(entry.keys()).isdisjoint(FORBIDDEN_MODULE_KEYS)
        assert isinstance(entry.get('starterArtifacts', []), list)
        assert isinstance(entry.get('promptStrips', []), list)
        assert isinstance(entry.get('subagentGroups', []), list)
        assert isinstance(entry.get('runtimeContext', []), list)


def test_jdr_starter_stays_on_shared_runtime_and_persistence_rails() -> None:
    manifest = get_artifact('graph', 'jdr_solo_session_starter')
    assert manifest is not None
    artifact = manifest['artifact']
    assert artifact['projectMode'] == 'langgraph'
    assert artifact['executionProfile'] == 'langgraph_async'
    runtime = artifact['runtimeSettings']
    assert 'moduleLibrary' in runtime
    assert 'loadedModuleIds' in runtime
    assert 'promptStripLibrary' in runtime
    assert 'promptStripAssignments' in runtime
    assert 'subagentLibrary' in runtime
    assert 'runtimeContext' in runtime
    assert 'obsidian' not in runtime
    assert 'jdrPersistence' not in runtime
