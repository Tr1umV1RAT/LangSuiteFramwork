from __future__ import annotations
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request
from contextlib import closing
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CLIENT_DIR = ROOT / 'client'
DIST_DIR = CLIENT_DIR / 'dist'
STATIC_DIR = ROOT / 'static'


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


def run():
    expect(DIST_DIR.exists(), 'client/dist missing')
    with tempfile.TemporaryDirectory(prefix='langsuite-v24-e2e-') as tmpdir:
        proc = start_backend(Path(tmpdir) / 'e2e.db', free_port())
        port = int(proc.args[-1])
        try:
            wait_for_http(f'http://127.0.0.1:{port}/?e2e=1')
            unique = f'LangSuite v24 Smoke {int(time.time())}'
            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium')
                page = browser.new_page(viewport={'width': 1440, 'height': 1100})
                page.goto(f'http://127.0.0.1:{port}/?e2e=1', wait_until='networkidle')

                # Inspector from catalog + selected node
                page.locator('[data-testid="palette-inspect-sub_agent"]').click()
                inspector = page.locator('[data-testid="capability-inspector"]')
                expect(inspector.is_visible(), 'inspector missing')
                expect('sub_agent' in inspector.inner_text(), 'catalog inspector missing sub_agent')

                node_id = page.evaluate("""() => {
                    const store = window.__LANGSUITE_STORE__;
                    store.getState().addNode('sub_agent', {x:260,y:220});
                    const nodes = store.getState().nodes;
                    return nodes[nodes.length-1].id;
                }""")
                node = page.locator(f'[data-testid="canvas-node-{node_id}"]')
                node.wait_for(state='visible')
                node.click()
                page.wait_for_timeout(250)
                expect('Surface target' in inspector.inner_text(), 'node selection did not drive inspector')

                # Child-tab opening
                page.locator(f'[data-testid="node-open-child-{node_id}"]').click()
                page.wait_for_timeout(350)
                tab_state = page.evaluate("""() => {
                    const state = window.__LANGSUITE_STORE__.getState();
                    const active = state.tabs.find((tab) => tab.id === state.activeTabId);
                    return {count: state.tabs.length, scopeKind: active?.scopeKind};
                }""")
                expect(tab_state['count'] >= 2 and tab_state['scopeKind'] == 'subgraph', 'child tab did not open coherently')

                # Export truthful project package
                page.locator('[data-testid="toolbar-open-package-menu"]').click()
                page.locator('[data-testid="package-menu"]').wait_for(state='visible')
                with page.expect_download() as dl_info:
                    page.locator('[data-testid="package-export-button"]').click()
                package_path = Path(tmpdir) / 'langsuite-package.json'
                dl_info.value.save_as(str(package_path))
                package_payload = json.loads(package_path.read_text(encoding='utf-8'))
                expect(package_payload['version'] == 'langsuite.v23.package', 'package version mismatch')
                expect(package_payload['summary']['childSubgraphCount'] >= 1, 'package missing child subgraph count')

                # Valid v23 package diagnostics
                page.locator('[data-testid="toolbar-open-package-menu"]').click()
                report = page.evaluate("""(payload) => {
                    return window.__LANGSUITE_STORE__.getState().loadProject(JSON.stringify(payload));
                }""", package_payload)
                expect(report['format'] == 'v23_package' and report['status'] == 'success', 'valid package did not report v23 success')
                report_ui = page.locator('[data-testid="package-import-report"]')
                report_ui.wait_for(state='visible')
                expect('Project package imported' in report_ui.inner_text(), 'success import report not rendered')

                # Partial/damaged package diagnostics
                partial_report = page.evaluate("""() => {
                    const payload = {
                        kind: 'project_package',
                        version: 'langsuite.v23.package',
                        packageType: 'editable_workspace',
                        exportedAt: new Date().toISOString(),
                        projectName: 'Partial Package',
                        workspaceTree: {
                            root: {
                                projectName: 'Partial Root',
                                nodes: [],
                                edges: [],
                                isAsync: true,
                                scopeKind: 'project',
                                artifactType: 'graph',
                            }
                        }
                    };
                    return window.__LANGSUITE_STORE__.getState().loadProject(JSON.stringify(payload));
                }""")
                expect(partial_report['format'] == 'v23_package' and partial_report['status'] == 'warning', 'partial package did not warn')
                expect(partial_report['partialRecovery'] is True, 'partial package did not mark partial recovery')
                expect('Child subgraph list was missing' in page.locator('[data-testid="package-import-report"]').inner_text(), 'partial package warning not rendered')

                # Workspace-tree fallback diagnostics
                fallback_report = page.evaluate("""() => {
                    const payload = {
                        version: 'langsuite.v21.workspace',
                        root: {
                            projectName: 'Fallback Root',
                            nodes: [],
                            edges: [],
                            isAsync: true,
                            scopeKind: 'project',
                            artifactType: 'graph',
                        },
                        children: [],
                        activeScopeKey: null,
                        openChildScopeKeys: [],
                    };
                    return window.__LANGSUITE_STORE__.getState().loadProject(JSON.stringify(payload));
                }""")
                expect(fallback_report['format'] == 'workspace_tree_fallback', 'workspace-tree fallback not reported')
                expect(fallback_report['fallbackUsed'] is True, 'workspace-tree fallback flag missing')

                # Single-graph fallback diagnostics
                single_report = page.evaluate("""() => {
                    const payload = {
                        projectName: 'Single Graph Import',
                        nodes: [],
                        edges: [],
                        isAsync: true,
                    };
                    return window.__LANGSUITE_STORE__.getState().loadProject(JSON.stringify(payload));
                }""")
                expect(single_report['format'] == 'single_graph_fallback', 'single-graph fallback not reported')
                expect(single_report['missing'][0] == 'known child subgraphs', 'single-graph missing summary incorrect')

                # Invalid package diagnostics
                invalid_report = page.evaluate("""() => {
                    const payload = {
                        kind: 'project_package',
                        version: 'langsuite.v23.package',
                        packageType: 'editable_workspace',
                        exportedAt: new Date().toISOString(),
                        projectName: 'Broken Package',
                        workspaceTree: null,
                    };
                    return window.__LANGSUITE_STORE__.getState().loadProject(JSON.stringify(payload));
                }""")
                expect(invalid_report['status'] == 'error' and invalid_report['format'] == 'invalid', 'invalid package did not error cleanly')
                expect('editable workspace tree' in invalid_report['message'], 'invalid package message missing workspace-tree explanation')

                # Restore valid package, save to app, reopen from project manager tree
                page.evaluate("""(payload, name) => {
                    const store = window.__LANGSUITE_STORE__;
                    store.getState().loadProject(JSON.stringify(payload));
                    store.getState().setProjectName(name);
                    store.getState().saveProject();
                }""", package_payload, unique)
                deadline = time.time() + 25
                while time.time() < deadline:
                    if page.evaluate("() => window.__LANGSUITE_STORE__.getState().saveStatus") == 'saved':
                        break
                    page.wait_for_timeout(250)
                expect(page.evaluate("() => window.__LANGSUITE_STORE__.getState().saveStatus") == 'saved', 'workspace save did not complete after valid package restore')

                page.reload(wait_until='networkidle')
                page.locator('[data-testid="toolbar-open-projects"]').click()
                modal = page.locator('[data-testid="project-manager-modal"]')
                modal.wait_for(state='visible')
                root_row = page.locator('[data-testid^="project-tree-root-"]', has_text=unique).first
                root_row.wait_for(state='visible')
                expect('Root graph' in root_row.inner_text(), 'project tree root row missing')
                expect(page.locator('[data-testid^="project-tree-child-"]', has_text='Editable subgraph').count() >= 1, 'project tree child row missing')

                # No fake visible runtime/editor modes
                expect(page.get_by_role('button', name=re.compile('LangChain', re.I)).count() == 0, 'LangChain mode resurfaced')
                expect(page.get_by_role('button', name=re.compile('DeepAgents', re.I)).count() == 0, 'DeepAgents mode resurfaced')
                browser.close()
        finally:
            stop_process(proc)
            if STATIC_DIR.exists():
                shutil.rmtree(STATIC_DIR)


if __name__ == '__main__':
    run()
