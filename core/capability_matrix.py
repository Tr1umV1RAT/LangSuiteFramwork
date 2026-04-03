from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

_MATRIX_PATH = Path(__file__).resolve().parent.parent / 'client' / 'src' / 'capabilityMatrix.json'


@lru_cache(maxsize=1)
def load_capability_matrix() -> dict[str, Any]:
    with _MATRIX_PATH.open('r', encoding='utf-8') as fh:
        data = json.load(fh)
    if not isinstance(data, dict):
        raise ValueError('capability matrix must be a JSON object')
    return data


@lru_cache(maxsize=1)
def rail_meta() -> dict[str, dict[str, Any]]:
    raw = load_capability_matrix().get('rails', {})
    if not isinstance(raw, dict):
        raise ValueError('rails must be a mapping')
    return {str(key): value for key, value in raw.items() if isinstance(value, dict)}



@lru_cache(maxsize=1)
def project_mode_meta() -> dict[str, dict[str, Any]]:
    raw = load_capability_matrix().get('projectModes', {})
    if not isinstance(raw, dict):
        raise ValueError('projectModes must be a mapping')
    return {str(key): value for key, value in raw.items() if isinstance(value, dict)}


@lru_cache(maxsize=1)
def known_project_modes() -> tuple[str, ...]:
    return tuple(project_mode_meta().keys())


@lru_cache(maxsize=1)
def visible_project_modes() -> tuple[str, ...]:
    return tuple(mode for mode, meta in project_mode_meta().items() if bool(meta.get('visible')))

@lru_cache(maxsize=1)
def artifact_kind_meta() -> dict[str, dict[str, Any]]:
    raw = load_capability_matrix().get('artifactKinds', {})
    if not isinstance(raw, dict):
        raise ValueError('artifactKinds must be a mapping')
    return {str(key): value for key, value in raw.items() if isinstance(value, dict)}


@lru_cache(maxsize=1)
def execution_profile_meta() -> dict[str, dict[str, Any]]:
    raw = load_capability_matrix().get('executionProfiles', {})
    if not isinstance(raw, dict):
        raise ValueError('executionProfiles must be a mapping')
    return {str(key): value for key, value in raw.items() if isinstance(value, dict)}


@lru_cache(maxsize=1)
def known_artifact_kinds() -> tuple[str, ...]:
    return tuple(artifact_kind_meta().keys())


@lru_cache(maxsize=1)
def visible_artifact_kinds() -> tuple[str, ...]:
    return tuple(kind for kind, meta in artifact_kind_meta().items() if bool(meta.get('visible')))


@lru_cache(maxsize=1)
def visible_library_artifact_kinds() -> tuple[str, ...]:
    return tuple(kind for kind, meta in artifact_kind_meta().items() if bool(meta.get('libraryVisible')))


@lru_cache(maxsize=1)
def advanced_library_artifact_kinds() -> tuple[str, ...]:
    return tuple(kind for kind, meta in artifact_kind_meta().items() if bool(meta.get('advancedLibraryVisible')))


@lru_cache(maxsize=1)
def advanced_artifact_kinds() -> tuple[str, ...]:
    return tuple(kind for kind, meta in artifact_kind_meta().items() if str(meta.get('surfaceLevel')) == 'advanced')


@lru_cache(maxsize=1)
def legacy_artifact_kinds() -> tuple[str, ...]:
    return tuple(kind for kind, meta in artifact_kind_meta().items() if bool(meta.get('legacy')))


@lru_cache(maxsize=1)
def artifact_directory_map() -> dict[str, str]:
    return {
        kind: str(meta.get('artifactDirectory', f'{kind}s'))
        for kind, meta in artifact_kind_meta().items()
    }


@lru_cache(maxsize=1)
def known_execution_profiles() -> tuple[str, ...]:
    return tuple(execution_profile_meta().keys())


@lru_cache(maxsize=1)
def visible_execution_profiles() -> tuple[str, ...]:
    return tuple(profile for profile, meta in execution_profile_meta().items() if bool(meta.get('visible')))


@lru_cache(maxsize=1)
def advanced_execution_profiles() -> tuple[str, ...]:
    return tuple(profile for profile, meta in execution_profile_meta().items() if str(meta.get('surfaceLevel')) == 'advanced')


@lru_cache(maxsize=1)
def legacy_execution_profiles() -> tuple[str, ...]:
    return tuple(profile for profile, meta in execution_profile_meta().items() if bool(meta.get('legacy')))


def artifact_kinds_for_surface(surface: str = 'default') -> tuple[str, ...]:
    if surface == 'internal':
        return known_artifact_kinds()
    if surface == 'advanced':
        ordered = list(visible_library_artifact_kinds())
        for kind in advanced_library_artifact_kinds():
            if kind not in ordered:
                ordered.append(kind)
        return tuple(ordered)
    return visible_library_artifact_kinds()
