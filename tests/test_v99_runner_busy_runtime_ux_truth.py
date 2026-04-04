from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUN_PANEL = ROOT / "client" / "src" / "components" / "RunPanel.tsx"


def test_latest_issue_card_surfaces_reason_code_and_actionable_hint_for_runner_busy() -> None:
    text = RUN_PANEL.read_text(encoding="utf-8")
    assert "data-testid={latestError ? 'runtime-latest-issue-card' : 'runtime-awaiting-resume-card'}" in text
    assert 'data-testid="runtime-latest-issue-hint"' in text
    assert "latestError?.reasonCode" in text
    assert "{latestError.reasonCode}" in text


def test_runner_busy_latest_issue_hint_keeps_session_limit_truth_explicit() -> None:
    text = RUN_PANEL.read_text(encoding="utf-8")
    assert 'Wait for the active runtime session to finish or stop it before starting another one.' in text
    assert 'The current limit is about separate Run sessions sharing one backend process, not about fan-out inside a single graph.' in text
