from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.schemas import RuntimeSettings

TYPES = ROOT / 'client' / 'src' / 'store' / 'types.ts'
WORKSPACE = ROOT / 'client' / 'src' / 'store' / 'workspace.ts'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'
WINDOWS_QA = ROOT / 'tests' / 'windows_qa_sanity.py'
BRANCH_PLAN = ROOT / 'v94_jdr_branch_opening_plan.md'
CHATGPT_RECO = ROOT / 'v94_chatgpt_project_recommendation.md'


def _load_module(path: Path, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_runtime_settings_backend_accepts_branch_seam_module_metadata() -> None:
    settings = RuntimeSettings(
        moduleLibrary=[
            {
                'id': 'module_jdr_worldpack',
                'name': 'JDR World Pack',
                'category': 'world',
                'lineage': 'branch_overlay',
                'branchTargets': ['main', 'jdr_demo'],
                'recommendedProfile': 'tabletop_demo',
                'themeHints': ['paper', 'fantasy'],
                'compatibilityNotes': 'Safe on trunk; richer rendering on the demo branch.',
                'promptStrips': [
                    {'id': 'canon', 'name': 'Canon', 'body': 'Respect the canon.'},
                ],
            }
        ]
    )
    entry = settings.moduleLibrary[0]
    assert entry.lineage == 'branch_overlay'
    assert entry.branchTargets == ['main', 'jdr_demo']
    assert entry.recommendedProfile == 'tabletop_demo'
    assert entry.themeHints == ['paper', 'fantasy']
    assert 'demo branch' in entry.compatibilityNotes


def test_workspace_and_types_include_branch_seam_module_contract() -> None:
    types_text = TYPES.read_text(encoding='utf-8')
    assert "export type ModuleLibraryLineage = 'shared' | 'branch_overlay';" in types_text
    assert 'branchTargets: string[];' in types_text
    assert 'recommendedProfile?: string;' in types_text
    assert 'themeHints: string[];' in types_text
    assert 'compatibilityNotes?: string;' in types_text

    workspace_text = WORKSPACE.read_text(encoding='utf-8')
    assert 'sanitizeModuleLineage' in workspace_text
    assert 'sanitizeIdentifierList' in workspace_text
    assert 'lineage: sanitizeModuleLineage(data.lineage)' in workspace_text
    assert 'branchTargets: sanitizeIdentifierList(data.branchTargets)' in workspace_text
    assert "recommendedProfile: typeof data.recommendedProfile === 'string'" in workspace_text
    assert 'themeHints: sanitizeIdentifierList(data.themeHints)' in workspace_text
    assert "compatibilityNotes: typeof data.compatibilityNotes === 'string'" in workspace_text


def test_state_panel_exposes_branch_metadata_without_claiming_new_runtime() -> None:
    text = STATE_PANEL.read_text(encoding='utf-8')
    assert 'branch/profile metadata' in text
    assert 'future domain branch (for example a tabletop RPG demo)' in text
    assert 'Branch metadata is advisory in v94' in text
    assert 'branch targets (main, jdr_demo)' in text
    assert 'recommended profile (optional)' in text
    assert 'theme hints (paper, fantasy, noir)' in text
    assert 'Compatibility notes for trunk / future domain branches' in text
    assert 'branch overlay' in text.lower() or 'Branch overlay' in text


def test_v94_docs_exist_and_recommend_split_chatgpt_projects_after_fork() -> None:
    branch_plan = BRANCH_PLAN.read_text(encoding='utf-8')
    chatgpt_reco = CHATGPT_RECO.read_text(encoding='utf-8')
    assert 'Opening seam from `main` toward a future tabletop-RPG demo branch' in branch_plan
    assert 'two ChatGPT projects/conversations' in chatgpt_reco
    assert 'Project A' in chatgpt_reco and 'Project B' in chatgpt_reco


def test_windows_installer_sanity_wrapper_still_passes_v94() -> None:
    module = _load_module(WINDOWS_QA, 'windows_qa_sanity_v94')
    module.run()
