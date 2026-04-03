from __future__ import annotations

import shutil, socket, subprocess, sys, tempfile, time, urllib.request
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
            backup_dir = CHROMIUM_POLICY_DIR.with_name('managed.bak_langsuite_v39')
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
    if STATIC_DIR.exists(): shutil.rmtree(STATIC_DIR)
    shutil.copytree(DIST_DIR, STATIC_DIR)
    return subprocess.Popen([sys.executable, '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', str(port)], cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

def stop_process(proc):
    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill(); proc.wait(timeout=5)

def expect(cond: bool, msg: str):
    if not cond:
        raise AssertionError(msg)

def run():
    expect(DIST_DIR.exists(), 'client/dist missing; build the frontend before browser smoke')
    port = free_port(); proc = start_backend(port)
    try:
        wait_for_http(f'http://127.0.0.1:{port}/?e2e=v39')
        with temporary_local_url_policy_lift():
            with sync_playwright() as pw:
                with tempfile.TemporaryDirectory(prefix='langsuite-v39-chromium-') as profile_dir:
                    context = pw.chromium.launch_persistent_context(profile_dir, headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'], viewport={'width': 1440, 'height': 1024})
                    page = context.pages[0] if context.pages else context.new_page()
                    page.goto(f'http://127.0.0.1:{port}/?e2e=1', wait_until='networkidle')
                    page.wait_for_function('() => Boolean(window.__LANGSUITE_STORE__)')
                    page.evaluate("""() => { const s = window.__LANGSUITE_STORE__.getState(); s.setEditorMode('advanced'); s.updatePreferences({ paletteMode: 'all', palettePreset: 'advanced' }); }""")
                    page.wait_for_timeout(500)
                    bridge_info = page.evaluate("""async () => {
                        const res = await fetch('/api/artifacts?include_advanced=true&project_mode=langgraph');
                        const payload = await res.json();
                        const agent = payload.find((item) => item.kind === 'agent' && item.id === 'embedded_provider_agent');
                        if (!agent) return null;
                        return { models: agent.bridgeModels || [] };
                    }""")
                    expect(bridge_info is not None, f'expected embedded_provider_agent in LangGraph advanced library: {bridge_info}')
                    embedded = next((item for item in bridge_info['models'] if item.get('integrationModel') == 'embedded_native'), None)
                    expect(embedded is not None, f'expected embedded native model metadata: {bridge_info}')
                    expect(embedded['supportLevel'] == 'compile_capable', f'embedded support mismatch: {embedded}')
                    compiled_and_ran = page.evaluate(f"""async () => {{
                        const store = window.__LANGSUITE_STORE__;
                        const state = store.getState();
                        const active = state.tabs.find((tab) => tab.id === state.activeTabId);
                        if (!active || active.projectMode !== 'langgraph') {{
                          store.getState().openTab(null, 'LangGraph host', [], [], [], true, {{ projectMode: 'langgraph', artifactType: 'graph', executionProfile: 'langgraph_async' }});
                        }}
                        store.getState().addArtifactWrapperNode('agent', 'embedded_provider_agent', 'Embedded Native Provider Agent', 'embedded_native');
                        const payload = JSON.parse(store.getState().exportJson());
                        const compileRes = await fetch('/compile', {{ method: 'POST', headers: {{ 'Content-Type': 'application/json' }}, body: JSON.stringify(payload) }});
                        const compileOk = compileRes.ok;
                        const compileType = compileRes.headers.get('content-type') || '';
                        const terminal = await new Promise((resolve) => {{
                          const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
                          const ws = new WebSocket(`${{proto}}://127.0.0.1:{port}/api/ws/run/v39_browser_embedded_provider`);
                          let traces = [];
                          ws.onopen = () => ws.send(JSON.stringify({{ action: 'start', payload, inputs: {{ messages: ['browser embedded provider hello'] }} }}));
                          ws.onmessage = (event) => {{
                            const msg = JSON.parse(event.data);
                            if (msg.type === 'embedded_trace') traces.push({{ phase: msg.phase, reasonCode: msg.reasonCode || null, message: msg.message || null }});
                            if (msg.type === 'completed' || msg.type === 'error') {{
                              resolve({{ terminal: msg, traces }});
                              ws.close();
                            }}
                          }};
                          ws.onerror = () => resolve({{ terminal: {{ type: 'error', reason: 'ws_error' }}, traces }});
                        }});
                        return {{ compileOk, compileType, terminalType: terminal.terminal?.type || null, terminalMessage: terminal.terminal?.message || null, traces: terminal.traces || [] }};
                    }}""")
                    expect(compiled_and_ran['compileOk'] is True, f'compile failed for provider embedded artifact: {compiled_and_ran}')
                    expect('application/zip' in compiled_and_ran['compileType'], f'expected zip compile response: {compiled_and_ran}')
                    expect(compiled_and_ran['terminalType'] in ('completed', 'error'), f'expected terminal event: {compiled_and_ran}')
                    trace_phases = [item['phase'] for item in compiled_and_ran['traces']]
                    if compiled_and_ran['terminalType'] == 'error':
                        expect('provider_config_missing' in (compiled_and_ran['terminalMessage'] or ''), f'expected provider config error: {compiled_and_ran}')
                        expect('failed' in trace_phases, f'expected embedded failed trace: {compiled_and_ran}')
                    else:
                        expect('completed' in trace_phases, f'expected embedded completion trace: {compiled_and_ran}')
                    opened = page.evaluate("""async () => {
                        const store = window.__LANGSUITE_STORE__;
                        const wrapper = [...store.getState().nodes].reverse().find((node) => node.data?.params?.artifact_ref_id === 'embedded_provider_agent');
                        if (!wrapper) return { ok: false, reason: 'wrapper missing before reopen' };
                        await store.getState().openSubgraphTabFromNode(wrapper.id);
                        const next = store.getState();
                        const activeTab = next.tabs.find((tab) => tab.id === next.activeTabId);
                        const providerNode = next.nodes.find((node) => node.id === 'react_agent_1');
                        return { ok: true, activeProjectMode: activeTab?.projectMode || null, activeExecutionProfile: activeTab?.executionProfile || null, providerNodeType: providerNode?.data?.nodeType || null };
                    }""")
                    expect(opened['ok'] is True, f'wrapper open failed: {opened}')
                    expect(opened['activeProjectMode'] == 'langchain', f'expected LangChain mode after wrapper open: {opened}')
                    expect(opened['activeExecutionProfile'] == 'langchain_agent', f'expected LangChain profile after wrapper open: {opened}')
                    expect(opened['providerNodeType'] == 'react_agent', f'expected provider node in reopened artifact: {opened}')
                    context.close()
    finally:
        stop_process(proc)

if __name__ == '__main__':
    run()
