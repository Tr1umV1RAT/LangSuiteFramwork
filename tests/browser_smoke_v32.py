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
            backup_dir = CHROMIUM_POLICY_DIR.with_name('managed.bak_langsuite_v32')
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
        wait_for_http(f'http://127.0.0.1:{port}/?e2e=v32')
        with temporary_local_url_policy_lift():
            with sync_playwright() as pw:
                with tempfile.TemporaryDirectory(prefix='langsuite-v32-chromium-') as profile_dir:
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

                    page.wait_for_timeout(500)
                    expect(page.locator('[data-testid="palette-item-react_agent"]').count() == 0, 'react_agent should not appear in the default/simple palette')

                    artifacts_visible = page.evaluate("""async () => {
                        const res = await fetch('/api/artifacts');
                        return await res.json();
                    }""")
                    expect(sorted({item['kind'] for item in artifacts_visible}) == ['graph', 'subgraph'], f'default artifact surface drifted: {artifacts_visible}')

                    page.evaluate("""() => {
                        const s = window.__LANGSUITE_STORE__.getState();
                        s.setEditorMode('advanced');
                        s.updatePreferences({ paletteMode: 'all', palettePreset: 'advanced' });
                    }""")
                    page.wait_for_timeout(500)
                    expect(page.locator('[data-testid="palette-item-react_agent"]').count() > 0, 'react_agent should appear in advanced mode')
                    expect(page.locator('[data-testid="palette-item-deep_agent_suite"]').count() > 0, 'deep_agent_suite should appear in advanced mode')

                    artifacts_advanced = page.evaluate("""async () => {
                        const res = await fetch('/api/artifacts?include_advanced=true');
                        return await res.json();
                    }""")
                    advanced_kinds = sorted({item['kind'] for item in artifacts_advanced})
                    expect(advanced_kinds == ['agent', 'deep_agent', 'graph', 'subgraph'], f'advanced artifact surface mismatch: {advanced_kinds}')

                    advanced_tab = page.evaluate("""() => {
                        const store = window.__LANGSUITE_STORE__;
                        store.getState().openTab(null, 'Advanced Agent Shell', [], [], [], true, { artifactType: 'agent', executionProfile: 'langchain_agent' });
                        const state = store.getState();
                        const active = state.tabs.find((tab) => tab.id === state.activeTabId);
                        return { artifactType: active?.artifactType || null, executionProfile: active?.executionProfile || null };
                    }""")
                    expect(advanced_tab['artifactType'] == 'agent', f'advanced artifact type was not preserved: {advanced_tab}')
                    expect(advanced_tab['executionProfile'] == 'langchain_agent', f'advanced execution profile was not preserved: {advanced_tab}')
                    context.close()
    finally:
        stop_process(proc)


if __name__ == '__main__':
    run()
