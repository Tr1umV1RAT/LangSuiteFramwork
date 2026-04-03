import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router as compile_router
from api.collaboration import router as collab_router
from api.runner import router as runner_router
from api.artifacts import router as artifacts_router
from core.artifact_registry import bootstrap_builtin_manifests
import db


@asynccontextmanager
async def lifespan(app: FastAPI):
    bootstrap_builtin_manifests()
    yield


app = FastAPI(
    title="LangGraph Visual Builder - Compiler API",
    description="Compiles a visual graph JSON into a production-ready LangGraph Python project (.zip).",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(compile_router)
app.include_router(collab_router)
app.include_router(runner_router)
app.include_router(artifacts_router)

STATIC_DIR = Path(__file__).parent / "static"

if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
