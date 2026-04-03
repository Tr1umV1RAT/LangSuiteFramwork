from __future__ import annotations

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
            backup_dir = CHROMIUM_POLICY_DIR.with_name('managed.bak_langsuite_v36')
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
        wait_for_http(f'http://127.0.0.1:{port}/?e2e=v36')
        with temporary_local_url_policy_lift():
            with sync_playwright() as pw:
                with tempfile.TemporaryDirectory(prefix='langsuite-v36-chromium-') as profile_dir:
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
                    page.evaluate("""() => {
                        const s = window.__LANGSUITE_STORE__.getState();
                        s.setEditorMode('advanced');
                        s.updatePreferences({ paletteMode: 'all', palettePreset: 'advanced' });
                    }""")
                    page.wait_for_timeout(500)

                    bridge_info = page.evaluate("""async () => {
                        const res = await fetch('/api/artifacts?include_advanced=true&project_mode=langgraph');
                        const payload = await res.json();
                        const agent = payload.find((item) => item.kind === 'agent' && item.id === 'dice_agent');
                        return agent ? {
                          bridgeStatus: agent.bridgeStatus || null,
                          bridgeSupportLevel: agent.bridgeSupportLevel || null,
                          bridgeContractIds: agent.bridgeContractIds || [],
                          bridgeConstraints: agent.bridgeConstraints || [],
                        } : null;
                    }""")
                    expect(bridge_info is not None, 'expected dice_agent in LangGraph advanced library')
                    expect(bridge_info['bridgeStatus'] == 'supported', f'bridge status mismatch: {bridge_info}')
                    expect(bridge_info['bridgeSupportLevel'] == 'compile_capable', f'bridge support mismatch: {bridge_info}')
                    expect('langchain_agent_to_langgraph_v2' in bridge_info['bridgeContractIds'], f'expected v2 contract metadata: {bridge_info}')
                    expect(any('rpg_dice_roller' in entry for entry in bridge_info['bridgeConstraints']), f'expected tool constraint metadata: {bridge_info}')

                    compiled = page.evaluate("""async () => {
                        const store = window.__LANGSUITE_STORE__;
                        const state = store.getState();
                        const active = state.tabs.find((tab) => tab.id === state.activeTabId);
                        if (!active || active.projectMode !== 'langgraph') {
                          store.getState().openTab(null, 'LangGraph host', [], [], [], true, { projectMode: 'langgraph', artifactType: 'graph', executionProfile: 'langgraph_async' });
                        }
                        store.getState().addArtifactWrapperNode('agent', 'dice_agent', 'Dice Agent Workflow');
                        const afterInsert = store.getState();
                        const wrapper = [...afterInsert.nodes].reverse().find((node) => node.data?.params?.artifact_ref_id === 'dice_agent');
                        if (!wrapper) return { ok: false, reason: 'wrapper missing' };
                        const payload = JSON.parse(store.getState().exportJson());
                        const res = await fetch('/compile', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(payload),
                        });
                        const contentType = res.headers.get('content-type') || '';
                        return { ok: res.ok, status: res.status, contentType };
                    }""")
                    expect(compiled['ok'] is True, f'compile failed for v2 executable bridge: {compiled}')
                    expect('application/zip' in compiled['contentType'], f'expected zip compile response: {compiled}')

                    opened = page.evaluate("""async () => {
                        const store = window.__LANGSUITE_STORE__;
                        const wrapper = [...store.getState().nodes].reverse().find((node) => node.data?.params?.artifact_ref_id === 'dice_agent');
                        if (!wrapper) return { ok: false, reason: 'wrapper missing before reopen' };
                        await store.getState().openSubgraphTabFromNode(wrapper.id);
                        const next = store.getState();
                        const activeTab = next.tabs.find((tab) => tab.id === next.activeTabId);
                        const toolNode = next.nodes.find((node) => node.id === 'dice_tool_1');
                        const toolEdge = next.edges.find((edge) => edge.source === 'dice_tool_1' && edge.target === 'react_agent_2');
                        return {
                          ok: true,
                          activeProjectMode: activeTab?.projectMode || null,
                          activeArtifactType: activeTab?.artifactType || null,
                          activeExecutionProfile: activeTab?.executionProfile || null,
                          toolNodeType: toolNode?.data?.nodeType || null,
                          hasToolEdge: Boolean(toolEdge),
                        };
                    }""")
                    expect(opened['ok'] is True, f'wrapper open failed: {opened}')
                    expect(opened['activeProjectMode'] == 'langchain', f'expected referenced source artifact to open in LangChain mode: {opened}')
                    expect(opened['activeArtifactType'] == 'agent', f'expected agent artifact tab after wrapper open: {opened}')
                    expect(opened['activeExecutionProfile'] == 'langchain_agent', f'expected LangChain execution profile after wrapper open: {opened}')
                    expect(opened['toolNodeType'] == 'tool_rpg_dice_roller', f'expected hydrated dice tool node in reopened artifact: {opened}')
                    expect(opened['hasToolEdge'] is True, f'expected hydrated tool edge in reopened artifact: {opened}')
                    context.close()
    finally:
        stop_process(proc)


if __name__ == '__main__':
    run()
