from __future__ import annotations

import json
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from contextlib import closing, contextmanager
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CLIENT_DIR = ROOT / 'client'
DIST_DIR = CLIENT_DIR / 'dist'
STATIC_DIR = ROOT / 'static'
CHROMIUM_POLICY_DIR = Path('/etc/chromium/policies/managed')


@contextmanager
def temporary_local_url_policy_lift():
    backup_dir = None
    try:
        if CHROMIUM_POLICY_DIR.exists():
            backup_dir = CHROMIUM_POLICY_DIR.with_name('managed.bak_langsuite_v31')
            if backup_dir.exists():
                shutil.rmtree(backup_dir)
            CHROMIUM_POLICY_DIR.rename(backup_dir)
        yield
    finally:
        if backup_dir is not None and backup_dir.exists():
            if CHROMIUM_POLICY_DIR.exists():
                shutil.rmtree(CHROMIUM_POLICY_DIR)
            backup_dir.rename(CHROMIUM_POLICY_DIR)


def wait_for_http(url: str, timeout: float = 30.0):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                if resp.status < 500:
                    return
        except Exception as exc:
            last = exc
            time.sleep(0.25)
    raise RuntimeError(f'timed out waiting for {url}: {last}')


def free_port() -> int:
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
        sock.bind(('127.0.0.1', 0))
        return int(sock.getsockname()[1])


def start_backend(port: int):
    if STATIC_DIR.exists():
        shutil.rmtree(STATIC_DIR)
    shutil.copytree(DIST_DIR, STATIC_DIR)
    return subprocess.Popen(
        [sys.executable, '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', str(port)],
        cwd=str(ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )


def stop_process(proc):
    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)


def expect(cond: bool, msg: str):
    if not cond:
        raise AssertionError(msg)


def run():
    expect(DIST_DIR.exists(), 'client/dist missing; build the frontend before browser smoke')
    port = free_port()
    proc = start_backend(port)
    try:
        wait_for_http(f'http://127.0.0.1:{port}/?e2e=v31')
        with temporary_local_url_policy_lift():
            with sync_playwright() as pw:
                with tempfile.TemporaryDirectory(prefix='langsuite-v31-chromium-') as profile_dir:
                    context = pw.chromium.launch_persistent_context(
                        profile_dir,
                        headless=True,
                        executable_path='/usr/bin/chromium',
                        args=['--no-sandbox'],
                        viewport={'width': 1440, 'height': 1024},
                    )
                    page = context.pages[0] if context.pages else context.new_page()
                    page.goto(f'http://127.0.0.1:{port}/?e2e=1', wait_until='networkidle')
                    page.wait_for_function('() => Boolean(window.__LANGSUITE_STORE__)')

                    artifacts = page.evaluate("""async () => {
                        const res = await fetch('/api/artifacts');
                        return await res.json();
                    }""")
                    expect(isinstance(artifacts, list), f'artifact payload was not a list: {type(artifacts).__name__}')
                    artifact_kinds = sorted({item['kind'] for item in artifacts})
                    expect(artifact_kinds == ['graph', 'subgraph'], f'visible artifact kinds drifted: {artifact_kinds}')

                    legacy_payload = json.dumps({
                        "kind": "project_package",
                        "version": "langsuite.v23.package",
                        "packageType": "editable_workspace",
                        "exportedAt": "2026-03-15T00:00:00Z",
                        "projectName": "Legacy Import Smoke",
                        "summary": {
                            "childSubgraphCount": 1,
                            "includes": ["root graph", "known child subgraphs", "saved graph settings"],
                            "excludes": [],
                            "layoutMetadataIncluded": True,
                        },
                        "workspaceTree": {
                            "version": "langsuite.v21.workspace",
                            "activeScopeKey": None,
                            "openChildScopeKeys": ["sub_agent_legacy/imported_child"],
                            "root": {
                                "projectId": None,
                                "projectName": "Legacy Root",
                                "nodes": [],
                                "edges": [],
                                "customStateSchema": [],
                                "graphBindings": [],
                                "isAsync": True,
                                "scopeKind": "project",
                                "scopePath": "legacy_root",
                                "artifactType": "agent",
                                "executionProfile": "langchain_agent",
                                "runtimeSettings": {"recursionLimit": 50, "streamMode": "updates", "debug": False, "inheritParentBindings": True},
                            },
                            "children": [{
                                "projectId": None,
                                "projectName": "Imported Child",
                                "nodes": [],
                                "edges": [],
                                "parentProjectId": None,
                                "parentNodeId": "sub_agent_legacy",
                                "customStateSchema": [],
                                "graphBindings": [],
                                "isAsync": True,
                                "scopeKind": "subgraph",
                                "scopePath": "sub_agent_legacy/imported_child",
                                "artifactType": "deep_agent",
                                "executionProfile": "deepagents",
                                "runtimeSettings": {"recursionLimit": 50, "streamMode": "updates", "debug": False, "inheritParentBindings": True},
                            }],
                        },
                    })
                    page.evaluate("""(payload) => window.__LANGSUITE_STORE__.getState().loadProject(payload)""", legacy_payload)
                    normalized_state = page.evaluate("""() => {
                        const s = window.__LANGSUITE_STORE__.getState();
                        const root = s.tabs.find((tab) => tab.scopeKind === 'project');
                        const child = s.tabs.find((tab) => tab.scopeKind === 'subgraph');
                        return {
                          rootArtifactType: root?.artifactType || null,
                          rootExecutionProfile: root?.executionProfile || null,
                          childArtifactType: child?.artifactType || null,
                          childExecutionProfile: child?.executionProfile || null,
                        };
                    }""")
                    expect(normalized_state['rootArtifactType'] == 'agent', f'advanced root artifact was not preserved: {normalized_state}')
                    expect(normalized_state['rootExecutionProfile'] == 'langchain_agent', f'advanced root profile was not preserved: {normalized_state}')
                    expect(normalized_state['childArtifactType'] == 'subgraph', f'child artifact should still normalize to subgraph: {normalized_state}')
                    expect(normalized_state['childExecutionProfile'] in ('langgraph_sync', 'langgraph_async'), f'child execution should stay on the trunk: {normalized_state}')
                    context.close()
    finally:
        stop_process(proc)


if __name__ == '__main__':
    run()
