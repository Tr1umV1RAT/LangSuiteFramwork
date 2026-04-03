import logging
import re
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import ValidationError

from core.schemas import GraphPayload
from core.compiler import compile_graph

logger = logging.getLogger(__name__)

router = APIRouter()

_BRIDGE_CODE_RE = re.compile(r"^\[(?P<code>[a-z0-9_]+)\]\s*(?P<message>.*)$")


def _split_reason(message: str) -> tuple[str | None, str]:
    match = _BRIDGE_CODE_RE.match(message.strip())
    if not match:
        return None, message
    return match.group("code"), match.group("message")



@router.post("/compile", summary="Compile a visual graph JSON into a LangGraph project .zip")
async def compile_endpoint(request: Request):
    body = await request.json()
    try:
        payload = GraphPayload(**body)
    except ValidationError as ve:
        logger.error("Validation error: %s", ve)
        errors = []
        for e in ve.errors():
            raw_message = str(e.get("ctx", {}).get("error", e.get("msg", "")))
            reason_code, clean_message = _split_reason(raw_message)
            entry = {"msg": clean_message, "loc": e.get("loc", []), "type": e.get("type", "")}
            if reason_code:
                entry["reasonCode"] = reason_code
            errors.append(entry)
        return JSONResponse(
            status_code=422,
            content={
                "stage": "payload_validation",
                "summary": "Payload validation failed before Python export generation.",
                "errors": errors,
            },
        )
    try:
        zip_buffer = compile_graph(payload)
    except Exception as exc:
        logger.exception("Compilation error")
        return JSONResponse(
            status_code=500,
            content={
                "stage": "compile_generation",
                "summary": "Python export generation failed.",
                "message": str(exc),
            },
        )

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={payload.graph_id}.zip"},
    )
