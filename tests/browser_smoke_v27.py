from __future__ import annotations
import importlib.util
import os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
from contextlib import closing, contextmanager
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CLIENT_DIR = ROOT / 'client'
DIST_DIR = CLIENT_DIR / 'dist'
STATIC_DIR = ROOT / 'static'
HAS_LANGGRAPH = importlib.util.find_spec('langgraph') is not None



CHROMIUM_POLICY_DIR = Path('/etc/chromium/policies/managed')


@contextmanager
def temporary_local_url_policy_lift():
    backup_dir = None
    try:
        if CHROMIUM_POLICY_DIR.exists():
            backup_dir = CHROMIUM_POLICY_DIR.with_name('managed.bak_langsuite_v27')
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


def start_backend(db_path: Path, port: int):
    if STATIC_DIR.exists():
        shutil.rmtree(STATIC_DIR)
    shutil.copytree(DIST_DIR, STATIC_DIR)
    env = os.environ.copy()
    env['DB_PATH'] = str(db_path)
    return subprocess.Popen(
        [sys.executable, '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', str(port)],
        cwd=str(ROOT), env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
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


def wait_for(predicate, timeout: float = 10.0, interval: float = 0.2):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        last = predicate()
        if last:
            return last
        time.sleep(interval)
    raise AssertionError(f'timed out waiting for condition; last={last!r}')


def run():
    expect(DIST_DIR.exists(), 'client/dist missing')
    with tempfile.TemporaryDirectory(prefix='langsuite-v27-e2e-') as tmpdir:
        proc = start_backend(Path(tmpdir) / 'e2e.db', free_port())
        port = int(proc.args[-1])
        try:
            wait_for_http(f'http://127.0.0.1:{port}/?e2e=1')
            with temporary_local_url_policy_lift():
                with sync_playwright() as pw:
                    context = pw.chromium.launch_persistent_context(
                        str(Path(tmpdir) / 'chromium-profile'),
                        headless=True,
                        executable_path='/usr/bin/chromium',
                        args=['--no-sandbox'],
                        viewport={'width': 1536, 'height': 1100},
                    )
                    page = context.pages[0] if context.pages else context.new_page()
                    page.goto(f'http://127.0.0.1:{port}/?e2e=1', wait_until='networkidle')

                    expect(page.get_by_role('button', name=re.compile('LangChain', re.I)).count() == 0, 'LangChain mode resurfaced')
                    expect(page.get_by_role('button', name=re.compile('DeepAgents', re.I)).count() == 0, 'DeepAgents mode resurfaced')

                    prefs = page.evaluate("""() => { const p = window.__LANGSUITE_STORE__.getState().preferences; return { blocks: p.blocksPanelWidth, debug: p.debugPanelWidth, state: p.statePanelWidth, runHeight: p.runPanelHeightPercent }; }""")
                    expect(prefs['blocks'] <= 196 and prefs['debug'] <= 184 and prefs['state'] <= 208, f'panel defaults were not tightened: {prefs}')

                    # Reset root graph to a known empty state.
                    page.evaluate("""() => {
                        const store = window.__LANGSUITE_STORE__;
                        const state = store.getState();
                        const tabs = state.tabs.map((tab) => tab.id === state.activeTabId
                          ? { ...tab, nodes: [], edges: [], customStateSchema: [], graphBindings: [] }
                          : tab);
                        store.setState({ nodes: [], edges: [], graphValidation: null, tabs });
                    }""")

                    static_node_id = page.evaluate("""() => {
                        const store = window.__LANGSUITE_STORE__;
                        store.getState().addNode('static_text', { x: 180, y: 180 });
                        const node = store.getState().nodes.at(-1);
                        store.getState().updateNodeParam(node.id, 'text', 'Hello from v27 smoke');
                        return node.id;
                    }""")
                    node = page.locator(f'[data-testid="canvas-node-{static_node_id}"]')
                    node.wait_for(state='visible')
                    node_metrics = page.evaluate(f"""() => {{
                        const el = document.querySelector('[data-testid=\"canvas-node-{static_node_id}\"]');
                        const style = window.getComputedStyle(el);
                        return {{
                            offsetWidth: el.offsetWidth,
                            maxWidth: style.maxWidth,
                            paddingTop: window.getComputedStyle(el.querySelector('.node-body')).paddingTop,
                        }};
                    }}""")
                    expect(node_metrics['offsetWidth'] <= 320, f'node card width is still too loose: {node_metrics}')
                    expect(node_metrics['maxWidth'] in ('286px', '294px'), f'node card max-width did not reflect the tighter CSS: {node_metrics}')

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
                    expect(compile_result['ok'] is True, f'valid compile failed: {compile_result}')
                    expect('application/zip' in compile_result['contentType'], 'compile did not return zip content')
                    expect(compile_result['size'] > 500, 'compiled zip looks implausibly small')

                    # Valid graph run: either completes (if langgraph is installed here) or fails with a staged runtime-build error.
                    page.evaluate("""() => {
                        const store = window.__LANGSUITE_STORE__;
                        store.getState().clearRunLogs();
                        store.getState().startRun({ messages: [] });
                    }""")
                    run_result = wait_for(lambda: page.evaluate("""() => {
                        const logs = window.__LANGSUITE_STORE__.getState().runLogs;
                        const last = logs.at(-1);
                        if (!last) return null;
                        if (last.type === 'completed') return { type: last.type };
                        if (last.type === 'error') return { type: last.type, stage: last.data?.stage || null, message: last.message || '' };
                        return null;
                    }"""), timeout=12.0)
                    if HAS_LANGGRAPH:
                        expect(run_result['type'] in ('completed', 'error'), 'run did not produce a terminal state')
                    else:
                        expect(run_result['type'] == 'error', f'expected staged runtime error without langgraph, got {run_result}')
                        expect(run_result['stage'] in ('runtime_build', 'ws_error', 'runtime_execution'), f'run error did not expose a runtime stage: {run_result}')

                    # Unsupported hidden/legacy node payload now fails earlier in validation.
                    unsupported_errors = page.evaluate("""() => {
                        const store = window.__LANGSUITE_STORE__;
                        const state = store.getState();
                        const legacyNode = {
                            id: 'legacy_payload_1',
                            position: { x: 420, y: 180 },
                            data: { label: 'Legacy Payload', nodeType: 'mystery_legacy', params: {} },
                            type: 'custom',
                        };
                        const tabs = state.tabs.map((tab) => tab.id === state.activeTabId
                          ? { ...tab, nodes: [...state.nodes, legacyNode], edges: state.edges }
                          : tab);
                        store.setState({ nodes: [...state.nodes, legacyNode], tabs });
                        const validation = store.getState().runValidation();
                        return validation.errors;
                    }""")
                    expect(any('unknown type' in message.lower() for message in unsupported_errors), 'unsupported legacy payload was not blocked early')

                    # Reset again, then validate missing child-subgraph linkage before compile.
                    page.evaluate("""() => {
                        const store = window.__LANGSUITE_STORE__;
                        const state = store.getState();
                        const tabs = state.tabs.map((tab) => tab.id === state.activeTabId
                          ? { ...tab, nodes: [], edges: [], customStateSchema: [] }
                          : tab);
                        store.setState({ nodes: [], edges: [], graphValidation: null, tabs });
                        store.getState().addNode('sub_agent', { x: 220, y: 200 });
                        const node = store.getState().nodes.at(-1);
                        store.getState().updateNodeParam(node.id, 'target_subgraph', 'ghost_child');
                    }""")
                    validation_errors = page.evaluate("""() => window.__LANGSUITE_STORE__.getState().runValidation().errors""")
                    expect(any('child subgraph' in message.lower() for message in validation_errors), 'missing child subgraph target was not surfaced as an early error')

                    page.get_by_role('button', name='Compile Python').click()
                    notice = page.locator('.validation-banner .validation-banner-title')
                    notice.wait_for(state='visible')
                    expect('Compile blocked before request' in notice.inner_text(), 'compile blocker banner title missing')
                    expect('child subgraph' in page.locator('.validation-banner').inner_text().lower(), 'compile blocker banner did not explain the subgraph issue')

                    page.evaluate("""() => {
                        const store = window.__LANGSUITE_STORE__;
                        store.getState().clearRunLogs();
                        store.getState().startRun({ messages: [] });
                    }""")
                    blocked_run = wait_for(lambda: page.evaluate("""() => {
                        const logs = window.__LANGSUITE_STORE__.getState().runLogs;
                        const last = logs.at(-1);
                        if (!last || last.type !== 'error') return null;
                        return { message: last.message || '', stage: last.data?.stage || null };
                    }"""), timeout=6.0)
                    expect(blocked_run['stage'] == 'before_run', f'run blocker did not surface before_run stage: {blocked_run}')
                    expect('blocked before execution' in blocked_run['message'].lower(), 'run blocker message did not explain the stage')

                    context.close()
        finally:
            stop_process(proc)
            if STATIC_DIR.exists():
                shutil.rmtree(STATIC_DIR)


if __name__ == '__main__':
    run()
