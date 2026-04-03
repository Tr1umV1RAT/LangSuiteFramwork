from __future__ import annotations

from functools import lru_cache
from typing import Any

from core.capability_matrix import (
    artifact_kind_meta,
    execution_profile_meta,
    load_capability_matrix,
    known_project_modes,
    project_mode_meta,
)


@lru_cache(maxsize=1)
def mode_contract_meta() -> dict[str, dict[str, Any]]:
    raw = load_capability_matrix().get('modeContracts', {})
    if not isinstance(raw, dict):
        raise ValueError('modeContracts must be a mapping')
    return {str(key): value for key, value in raw.items() if isinstance(value, dict)}


@lru_cache(maxsize=1)
def interoperability_bridges() -> tuple[dict[str, Any], ...]:
    raw = load_capability_matrix().get('interoperabilityBridges', [])
    if not isinstance(raw, list):
        raise ValueError('interoperabilityBridges must be a list')
    return tuple(item for item in raw if isinstance(item, dict))


@lru_cache(maxsize=1)
def node_type_meta() -> dict[str, dict[str, Any]]:
    raw = load_capability_matrix().get('nodeTypes', {})
    if not isinstance(raw, dict):
        raise ValueError('nodeTypes must be a mapping')
    return {str(key): value for key, value in raw.items() if isinstance(value, dict)}


@lru_cache(maxsize=1)
def project_mode_contract(mode: str) -> dict[str, Any]:
    contracts = mode_contract_meta()
    if mode not in contracts:
        raise KeyError(f'Unknown project mode contract: {mode}')
    base = contracts[mode]
    mode_meta = project_mode_meta().get(mode, {})
    return {
        'label': base.get('label') or mode_meta.get('label') or mode,
        'allowedArtifactKinds': tuple(str(v) for v in base.get('allowedArtifactKinds', [])),
        'allowedExecutionProfiles': tuple(str(v) for v in base.get('allowedExecutionProfiles', [])),
        'compileEnabled': bool(base.get('compileEnabled', mode_meta.get('compileEnabled', False))),
        'runtimeEnabled': bool(base.get('runtimeEnabled', mode_meta.get('runtimeEnabled', False))),
        'defaultLibraryKinds': tuple(str(v) for v in base.get('defaultLibraryKinds', [])),
        'advancedLibraryKinds': tuple(str(v) for v in base.get('advancedLibraryKinds', [])),
        'bridgeTargets': tuple(str(v) for v in base.get('bridgeTargets', [])),
        'editorOnly': bool(base.get('editorOnly', False)),
    }


@lru_cache(maxsize=1)
def mode_allowed_node_types(mode: str) -> tuple[str, ...]:
    allowed: list[str] = []
    for node_type, meta in node_type_meta().items():
        project_modes = meta.get('allowedProjectModes') or list(known_project_modes())
        if isinstance(project_modes, list) and mode in project_modes:
            allowed.append(node_type)
    return tuple(sorted(set(allowed)))


@lru_cache(maxsize=1)
def mode_allowed_artifact_kinds(mode: str) -> tuple[str, ...]:
    return project_mode_contract(mode)['allowedArtifactKinds']


@lru_cache(maxsize=1)
def mode_allowed_execution_profiles(mode: str) -> tuple[str, ...]:
    return project_mode_contract(mode)['allowedExecutionProfiles']


@lru_cache(maxsize=1)
def mode_default_library_kinds(mode: str, *, include_advanced: bool = False) -> tuple[str, ...]:
    contract = project_mode_contract(mode)
    base = list(contract['defaultLibraryKinds'])
    if include_advanced:
        for kind in contract['advancedLibraryKinds']:
            if kind not in base:
                base.append(kind)
        for bridge in interoperability_bridges_for_target(mode):
            for kind in bridge.get('sourceArtifactKinds', []):
                if kind not in base:
                    base.append(kind)
    return tuple(base)


@lru_cache(maxsize=1)
def artifact_kind_to_project_mode() -> dict[str, str]:
    mapping: dict[str, str] = {}
    for mode in known_project_modes():
        for kind in mode_allowed_artifact_kinds(mode):
            mapping.setdefault(kind, mode)
    return mapping


@lru_cache(maxsize=1)
def execution_profile_to_project_mode() -> dict[str, str]:
    mapping: dict[str, str] = {}
    for mode in known_project_modes():
        for profile in mode_allowed_execution_profiles(mode):
            mapping.setdefault(profile, mode)
    return mapping


@lru_cache(maxsize=1)
def interoperability_bridges_for_target(target_mode: str) -> tuple[dict[str, Any], ...]:
    return tuple(bridge for bridge in interoperability_bridges() if bridge.get('targetMode') == target_mode)


@lru_cache(maxsize=1)
def interoperability_bridges_for_source(source_mode: str) -> tuple[dict[str, Any], ...]:
    return tuple(bridge for bridge in interoperability_bridges() if bridge.get('sourceMode') == source_mode)


def find_bridges(*, source_mode: str, target_mode: str, source_kind: str) -> tuple[dict[str, Any], ...]:
    return tuple(
        bridge
        for bridge in interoperability_bridges_for_target(target_mode)
        if bridge.get('sourceMode') == source_mode and source_kind in bridge.get('sourceArtifactKinds', [])
    )


def find_bridge(*, source_mode: str, target_mode: str, source_kind: str, integration_model: str | None = None) -> dict[str, Any] | None:
    bridges = find_bridges(source_mode=source_mode, target_mode=target_mode, source_kind=source_kind)
    if integration_model is not None:
        bridges = tuple(bridge for bridge in bridges if bridge.get('integrationModel') == integration_model)
    return bridges[0] if bridges else None


def infer_project_mode(*, artifact_type: str | None = None, execution_profile: str | None = None, project_mode: str | None = None) -> str:
    if project_mode and project_mode in known_project_modes():
        return project_mode
    if artifact_type:
        mapped = artifact_kind_to_project_mode().get(artifact_type)
        if mapped:
            return mapped
    if execution_profile:
        mapped = execution_profile_to_project_mode().get(execution_profile)
        if mapped:
            return mapped
    return 'langgraph'


def is_mode_artifact_allowed(mode: str, artifact_type: str | None) -> bool:
    return artifact_type in mode_allowed_artifact_kinds(mode)


def is_mode_execution_profile_allowed(mode: str, execution_profile: str | None) -> bool:
    return execution_profile in mode_allowed_execution_profiles(mode)


def is_mode_runtime_enabled(mode: str) -> bool:
    return bool(project_mode_contract(mode)['runtimeEnabled'])


def is_mode_compile_enabled(mode: str) -> bool:
    return bool(project_mode_contract(mode)['compileEnabled'])


def is_node_type_allowed_for_mode(mode: str, node_type: str) -> bool:
    meta = node_type_meta().get(node_type)
    if meta is None:
        return True
    project_modes = meta.get('allowedProjectModes') or list(known_project_modes())
    return mode in project_modes


def list_artifact_kinds_for_target_mode(mode: str, *, include_advanced: bool = False) -> tuple[str, ...]:
    return mode_default_library_kinds(mode, include_advanced=include_advanced)


def bridge_support_level(*, source_mode: str, target_mode: str, source_kind: str) -> str | None:
    bridge = find_bridge(source_mode=source_mode, target_mode=target_mode, source_kind=source_kind)
    return str(bridge.get('supportLevel')) if bridge else None


def is_bridge_compile_capable(*, source_mode: str, target_mode: str, source_kind: str) -> bool:
    bridge = find_bridge(source_mode=source_mode, target_mode=target_mode, source_kind=source_kind)
    if not bridge:
        return False
    return str(bridge.get('supportLevel')) in {'direct', 'compile_capable'}
