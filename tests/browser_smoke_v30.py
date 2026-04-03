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
            backup_dir = CHROMIUM_POLICY_DIR.with_name('managed.bak_langsuite_v30')
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
    proc = start_backend(free_port())
    port = int(proc.args[-1])
    try:
        wait_for_http(f'http://127.0.0.1:{port}/?e2e=v30')
        with temporary_local_url_policy_lift():
            with sync_playwright() as pw:
                with tempfile.TemporaryDirectory(prefix='langsuite-v30-chromium-') as profile_dir:
                    context = pw.chromium.launch_persistent_context(
                        profile_dir,
                        headless=True,
                        executable_path='/usr/bin/chromium',
                        args=['--no-sandbox'],
                        viewport={'width': 1536, 'height': 1100},
                    )
                    page = context.pages[0] if context.pages else context.new_page()
                    page.goto(f'http://127.0.0.1:{port}/?e2e=v30', wait_until='networkidle')
                    page.wait_for_function('() => Boolean(window.__LANGSUITE_STORE__)')

                    artifacts = page.evaluate("""async () => {
                        const res = await fetch('/api/artifacts');
                        return await res.json();
                    }""")
                    expect(sorted(list(artifacts.keys())) == ['graph', 'subgraph'], f'visible artifact API drifted: {sorted(list(artifacts.keys()))}')

                    sub_node_id = page.evaluate("""() => {
                        const store = window.__LANGSUITE_STORE__;
                        const state = store.getState();
                        const tabs = state.tabs.map((tab) => tab.id === state.activeTabId
                          ? { ...tab, nodes: [], edges: [], customStateSchema: [], graphBindings: [] }
                          : tab);
                        store.setState({ nodes: [], edges: [], graphValidation: null, tabs });
                        store.getState().addNode('sub_agent', { x: 200, y: 200 });
                        return store.getState().nodes.at(-1).id;
                    }""")
                    page.evaluate("""async (nodeId) => {
                        await window.__LANGSUITE_STORE__.getState().openSubgraphTabFromNode(nodeId);
                    }""", sub_node_id)

                    child_state = page.evaluate("""() => {
                        const s = window.__LANGSUITE_STORE__.getState();
                        const active = s.tabs.find((tab) => tab.id === s.activeTabId);
                        return {
                            tabCount: s.tabs.length,
                            rootCount: s.tabs.filter((tab) => tab.scopeKind === 'project').length,
                            childCount: s.tabs.filter((tab) => tab.scopeKind === 'subgraph').length,
                            activeScopeKind: active?.scopeKind || null,
                            childParentNodeId: s.tabs.find((tab) => tab.scopeKind === 'subgraph')?.parentNodeId || null,
                            childArtifactType: s.tabs.find((tab) => tab.scopeKind === 'subgraph')?.artifactType || null,
                        };
                    }""")
                    expect(child_state['tabCount'] == 2, f'child tab did not open: {child_state}')
                    expect(child_state['rootCount'] == 1, f'workspace grew extra roots: {child_state}')
                    expect(child_state['childCount'] == 1, f'expected one child subgraph tab: {child_state}')
                    expect(child_state['activeScopeKind'] == 'subgraph', f'child tab did not become active: {child_state}')
                    expect(child_state['childParentNodeId'] == sub_node_id, f'child tab lost parent node linkage: {child_state}')
                    expect(child_state['childArtifactType'] == 'subgraph', f'child tab artifact drifted: {child_state}')

                    page.evaluate("""() => {
                        const store = window.__LANGSUITE_STORE__;
                        store.getState().addNode('static_text', { x: 220, y: 220 });
                        const node = store.getState().nodes.at(-1);
                        store.getState().updateNodeParam(node.id, 'text', 'child export smoke');
                    }""")

                    exported = page.evaluate("() => window.__LANGSUITE_STORE__.getState().exportJson()")
                    exported_payload = json.loads(exported)
                    expect(exported_payload['workspaceTree']['root']['artifactType'] == 'graph', 'root export artifact type was not normalized')
                    expect(exported_payload['workspaceTree']['root']['executionProfile'] in ('langgraph_sync', 'langgraph_async'), 'root export execution profile drifted')
                    expect(len(exported_payload['workspaceTree']['children']) == 1, 'export lost child subgraph')
                    expect(exported_payload['workspaceTree']['children'][0]['artifactType'] == 'subgraph', 'child export artifact type drifted')
                    expect(exported_payload['workspaceTree']['children'][0]['parentNodeId'] == sub_node_id, 'child export lost parent node id')
                    expect(len(exported_payload['workspaceTree']['openChildScopeKeys']) == 1, 'export lost open child tab metadata')

                    import_report = page.evaluate("""(payload) => {
                        return window.__LANGSUITE_STORE__.getState().loadProject(payload);
                    }""", exported)
                    expect(import_report['status'] in ('success', 'warning'), f'import failed: {import_report}')

                    restored_state = page.evaluate("""() => {
                        const s = window.__LANGSUITE_STORE__.getState();
                        return {
                            tabCount: s.tabs.length,
                            rootCount: s.tabs.filter((tab) => tab.scopeKind === 'project').length,
                            childTabs: s.tabs.filter((tab) => tab.scopeKind === 'subgraph').map((tab) => ({
                                parentNodeId: tab.parentNodeId,
                                artifactType: tab.artifactType,
                                executionProfile: tab.executionProfile,
                                nodeCount: tab.nodes.length,
                            })),
                        };
                    }""")
                    expect(restored_state['tabCount'] == 2, f'import did not restore both tabs: {restored_state}')
                    expect(restored_state['rootCount'] == 1, f'import restored extra roots: {restored_state}')
                    expect(restored_state['childTabs'][0]['parentNodeId'] == sub_node_id, f'import lost child linkage: {restored_state}')
                    expect(restored_state['childTabs'][0]['artifactType'] == 'subgraph', f'import drifted child artifact type: {restored_state}')
                    expect(restored_state['childTabs'][0]['executionProfile'] in ('langgraph_sync', 'langgraph_async'), f'import drifted child execution profile: {restored_state}')
                    expect(restored_state['childTabs'][0]['nodeCount'] == 1, f'import lost child graph nodes: {restored_state}')

                    legacy_payload = json.loads(exported)
                    legacy_payload['artifactType'] = 'deep_agent'
                    legacy_payload['executionProfile'] = 'deepagents'
                    legacy_payload['workspaceTree']['root']['artifactType'] = 'agent'
                    legacy_payload['workspaceTree']['root']['executionProfile'] = 'langchain_agent'
                    legacy_payload['workspaceTree']['children'][0]['artifactType'] = 'deep_agent'
                    legacy_payload['workspaceTree']['children'][0]['executionProfile'] = 'deepagents'
                    page.evaluate("""(payload) => {
                        return window.__LANGSUITE_STORE__.getState().loadProject(JSON.stringify(payload));
                    }""", legacy_payload)
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
                    expect(normalized_state['rootArtifactType'] == 'graph', f'legacy import resurfaced root artifact drift: {normalized_state}')
                    expect(normalized_state['rootExecutionProfile'] in ('langgraph_sync', 'langgraph_async'), f'legacy import resurfaced root profile drift: {normalized_state}')
                    expect(normalized_state['childArtifactType'] == 'subgraph', f'legacy import resurfaced child artifact drift: {normalized_state}')
                    expect(normalized_state['childExecutionProfile'] in ('langgraph_sync', 'langgraph_async'), f'legacy import resurfaced child profile drift: {normalized_state}')

                    compile_result = page.evaluate("""async () => {
                        const payload = JSON.parse(window.__LANGSUITE_STORE__.getState().exportJson());
                        const res = await fetch('/compile', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                        });
                        const blob = await res.blob();
                        return {
                            ok: res.ok,
                            status: res.status,
                            contentType: res.headers.get('content-type') || '',
                            size: blob.size,
                        };
                    }""")
                    expect(compile_result['ok'] is True, f'compile after round-trip failed: {compile_result}')
                    expect('application/zip' in compile_result['contentType'], f'compile did not return a zip after round-trip: {compile_result}')
                    expect(compile_result['size'] > 500, f'compiled zip after round-trip looks too small: {compile_result}')

                    context.close()
    finally:
        stop_process(proc)


if __name__ == '__main__':
    run()
