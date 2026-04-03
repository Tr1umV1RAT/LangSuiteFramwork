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
            backup_dir = CHROMIUM_POLICY_DIR.with_name('managed.bak_langsuite_v33')
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
        wait_for_http(f'http://127.0.0.1:{port}/?e2e=v33')
        with temporary_local_url_policy_lift():
            with sync_playwright() as pw:
                with tempfile.TemporaryDirectory(prefix='langsuite-v33-chromium-') as profile_dir:
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
                    page.wait_for_timeout(600)

                    # default langgraph root
                    expect(page.locator('[data-testid="palette-item-llm_chat"]').count() > 0, 'llm_chat should appear in LangGraph mode')
                    expect(page.locator('[data-testid="palette-item-react_agent"]').count() == 0, 'react_agent should stay hidden outside LangChain mode')
                    expect(page.locator('[data-testid="palette-item-deep_agent_suite"]').count() == 0, 'deep_agent_suite should stay hidden outside DeepAgents mode')

                    langchain_state = page.evaluate("""() => {
                        const store = window.__LANGSUITE_STORE__;
                        store.getState().openTab(null, 'LangChain mode', [], [], [], true, { projectMode: 'langchain', artifactType: 'agent', executionProfile: 'langchain_agent' });
                        const state = store.getState();
                        const active = state.tabs.find((tab) => tab.id === state.activeTabId);
                        return { projectMode: active?.projectMode || null, artifactType: active?.artifactType || null, executionProfile: active?.executionProfile || null };
                    }""")
                    expect(langchain_state['projectMode'] == 'langchain', f'langchain tab mode mismatch: {langchain_state}')
                    page.wait_for_timeout(600)
                    expect(page.locator('[data-testid="palette-item-react_agent"]').count() > 0, 'react_agent should appear in LangChain mode')
                    expect(page.locator('[data-testid="palette-item-llm_chat"]').count() == 0, 'llm_chat should hide in LangChain mode')
                    expect(page.locator('[data-testid="palette-item-deep_agent_suite"]').count() == 0, 'deep_agent_suite should hide in LangChain mode')

                    deepagents_state = page.evaluate("""() => {
                        const store = window.__LANGSUITE_STORE__;
                        store.getState().openTab(null, 'DeepAgents mode', [], [], [], true, { projectMode: 'deepagents', artifactType: 'deep_agent', executionProfile: 'deepagents', runtimeSettings: { recursionLimit: 75, streamMode: 'values', debug: true, inheritParentBindings: true } });
                        const state = store.getState();
                        const active = state.tabs.find((tab) => tab.id === state.activeTabId);
                        return { projectMode: active?.projectMode || null, streamMode: active?.runtimeSettings?.streamMode || null };
                    }""")
                    expect(deepagents_state['projectMode'] == 'deepagents', f'deepagents tab mode mismatch: {deepagents_state}')
                    expect(deepagents_state['streamMode'] == 'values', f'deepagents stream default mismatch: {deepagents_state}')
                    page.wait_for_timeout(600)
                    expect(page.locator('[data-testid="palette-item-deep_agent_suite"]').count() > 0, 'deep_agent_suite should appear in DeepAgents mode')
                    expect(page.locator('[data-testid="palette-item-react_agent"]').count() == 0, 'react_agent should hide in DeepAgents mode')
                    expect(page.locator('[data-testid="palette-item-llm_chat"]').count() == 0, 'llm_chat should hide in DeepAgents mode')
                    context.close()
    finally:
        stop_process(proc)


if __name__ == '__main__':
    run()
