from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from core.artifact_registry import list_artifacts, get_artifact, save_artifact_manifest, bootstrap_builtin_manifests
from core.capability_matrix import known_project_modes

router = APIRouter(prefix="/api/artifacts", tags=["artifacts"])


class ArtifactSaveRequest(BaseModel):
    id: Optional[str] = None
    kind: str
    title: str
    description: str = ""
    artifact: dict[str, Any] = Field(default_factory=dict)


@router.get("")
def api_list_artifacts(
    kind: Optional[str] = Query(default=None),
    include_advanced: bool = Query(default=False, description="Include advanced but still trunk-dependent artifact families."),
    include_hidden: bool = Query(default=False, description="Include internal compatibility-only artifact families as well."),
    project_mode: Optional[str] = Query(default=None, description="Filter artifacts to a specific project mode surface."),
):
    if project_mode is not None and project_mode not in known_project_modes():
        raise HTTPException(422, f"Unknown project_mode: {project_mode}")
    return list_artifacts(kind, include_hidden=include_hidden, include_advanced=include_advanced, project_mode=project_mode)


@router.get("/{kind}/{artifact_id}")
def api_get_artifact(kind: str, artifact_id: str):
    artifact = get_artifact(kind, artifact_id)
    if artifact is None:
        raise HTTPException(404, "Artifact not found")
    return artifact


@router.post("")
def api_save_artifact(body: ArtifactSaveRequest):
    try:
        return save_artifact_manifest(body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
