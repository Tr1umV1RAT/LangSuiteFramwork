import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import ValidationError

from core.schemas import GraphPayload
from core.obsidian_export import build_obsidian_vault

logger = logging.getLogger(__name__)
router = APIRouter(prefix='/api/obsidian', tags=['obsidian'])


@router.post('/vault', summary='Export an Obsidian companion vault .zip from the current graph payload')
async def export_obsidian_vault(request: Request):
    body = await request.json()
    try:
        payload = GraphPayload(**body)
    except ValidationError as ve:
        logger.error('Validation error during Obsidian vault export: %s', ve)
        errors = []
        for e in ve.errors():
            raw_message = str(e.get('ctx', {}).get('error', e.get('msg', '')))
            errors.append({'msg': raw_message, 'loc': e.get('loc', []), 'type': e.get('type', '')})
        return JSONResponse(
            status_code=422,
            content={
                'stage': 'payload_validation',
                'summary': 'Payload validation failed before Obsidian vault export.',
                'errors': errors,
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
        headers={'Content-Disposition': f'attachment; filename={payload.graph_id}-obsidian-vault.zip'},
    )
