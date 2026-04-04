import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import ValidationError

from core.schemas import GraphPayload, ObsidianRecapApplyRequest
from core.obsidian_export import build_obsidian_vault
from core.obsidian_sync import apply_obsidian_recap

logger = logging.getLogger(__name__)
router = APIRouter(prefix='/api/obsidian', tags=['obsidian'])


def _validation_errors(ve: ValidationError) -> list[dict]:
    errors = []
    for e in ve.errors():
        raw_message = str(e.get('ctx', {}).get('error', e.get('msg', '')))
        errors.append({'msg': raw_message, 'loc': e.get('loc', []), 'type': e.get('type', '')})
    return errors


@router.post('/vault', summary='Export an Obsidian GM companion vault .zip from the current graph payload')
async def export_obsidian_vault(request: Request):
    body = await request.json()
    try:
        payload = GraphPayload(**body)
    except ValidationError as ve:
        logger.error('Validation error during Obsidian vault export: %s', ve)
        return JSONResponse(
            status_code=422,
            content={
                'stage': 'payload_validation',
                'summary': 'Payload validation failed before Obsidian vault export.',
                'errors': _validation_errors(ve),
            },
        )
    try:
        zip_buffer = build_obsidian_vault(payload)
    except Exception as exc:
        logger.exception('Obsidian vault export error')
        return JSONResponse(
            status_code=500,
            content={
                'stage': 'obsidian_export',
                'summary': 'Obsidian vault export failed.',
                'message': str(exc),
            },
        )
    return StreamingResponse(
        zip_buffer,
        media_type='application/zip',
        headers={'Content-Disposition': f'attachment; filename={payload.graph_id}-obsidian-gm-vault.zip'},
    )


@router.post('/recap/apply', summary='Apply a constrained Obsidian recap patch to runtime settings')
async def apply_obsidian_recap_patch(request: Request):
    body = await request.json()
    try:
        recap_request = ObsidianRecapApplyRequest(**body)
    except ValidationError as ve:
        logger.error('Validation error during Obsidian recap sync: %s', ve)
        return JSONResponse(
            status_code=422,
            content={
                'stage': 'recap_validation',
                'summary': 'Recap payload validation failed before runtime patching.',
                'errors': _validation_errors(ve),
            },
        )

    payload = recap_request.graphPayload
    runtime_settings = payload.ui_context.runtime_settings if payload.ui_context else None
    if runtime_settings is None:
        return JSONResponse(
            status_code=400,
            content={
                'stage': 'recap_runtime_context',
                'summary': 'graphPayload.ui_context.runtime_settings is required for recap sync.',
            },
        )

    try:
        patched_runtime, report = apply_obsidian_recap(runtime_settings, recap_request.recap)
    except Exception as exc:
        logger.exception('Obsidian recap sync error')
        return JSONResponse(
            status_code=500,
            content={
                'stage': 'recap_apply',
                'summary': 'Obsidian recap apply failed.',
                'message': str(exc),
            },
        )

    if recap_request.failOnConflict and report.get('conflict_count', 0) > 0:
        return JSONResponse(
            status_code=409,
            content={
                'stage': 'recap_conflict',
                'summary': 'Recap patch conflicts with runtime source-of-truth.',
                'report': report,
                'runtimeSettings': patched_runtime.model_dump(mode='json'),
            },
        )

    return JSONResponse(
        status_code=200,
        content={
            'graph_id': payload.graph_id,
            'session_id': recap_request.recap.sessionId,
            'summary': 'Recap patch processed.',
            'report': report,
            'runtimeSettings': patched_runtime.model_dump(mode='json'),
            'conflictsPresent': report.get('conflict_count', 0) > 0,
        },
    )
