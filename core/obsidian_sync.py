from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from core.schemas import (
    ObsidianRecapPayload,
    RuntimeSettings,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _merge_value(
    *,
    current: Any,
    incoming: Any,
    merge_policy: str,
    label: str,
    conflicts: list[str],
    applied: list[str],
    skipped: list[str],
) -> Any:
    if incoming is None:
        return current
    if current == incoming:
        return current
    if merge_policy == "preserve":
        skipped.append(f"{label}: preserve kept existing value")
        return current
    if merge_policy == "replace":
        applied.append(f"{label}: replaced")
        return incoming
    conflicts.append(f"{label}: conflict (existing value differs and mergePolicy=error)")
    return current


def _set_runtime_context(
    runtime_settings: RuntimeSettings,
    *,
    key: str,
    value: str,
    merge_policy: str,
    conflicts: list[str],
    applied: list[str],
    skipped: list[str],
) -> None:
    context_map = {entry["key"]: entry["value"] for entry in runtime_settings.runtimeContext}
    current = context_map.get(key)
    merged = _merge_value(
        current=current,
        incoming=value,
        merge_policy=merge_policy,
        label=f"runtimeContext.{key}",
        conflicts=conflicts,
        applied=applied,
        skipped=skipped,
    )
    context_map[key] = str(merged)
    runtime_settings.runtimeContext = [{"key": k, "value": v} for k, v in context_map.items()]


def _scene_index(runtime_settings: RuntimeSettings) -> dict[str, Any]:
    return {item.id: item for item in runtime_settings.sceneSeeds}


def _encounter_index(runtime_settings: RuntimeSettings) -> dict[str, Any]:
    return {item.id: item for item in runtime_settings.encounterSeeds}


def _location_index(runtime_settings: RuntimeSettings) -> dict[str, Any]:
    return {item.id: item for item in runtime_settings.locationSeeds}


def _clock_index(runtime_settings: RuntimeSettings) -> dict[str, Any]:
    return {item.id: item for item in runtime_settings.clockSeeds}


def _faction_index(runtime_settings: RuntimeSettings) -> dict[str, Any]:
    return {item.id: item for item in runtime_settings.factionSeeds}


def _hook_index(runtime_settings: RuntimeSettings) -> dict[str, Any]:
    return {item.id: item for item in runtime_settings.hookSeeds}


def apply_obsidian_recap(runtime_settings: RuntimeSettings, recap: ObsidianRecapPayload) -> tuple[RuntimeSettings, dict[str, Any]]:
    """Apply a constrained Obsidian recap onto RuntimeSettings.

    LangSuite remains runtime source-of-truth; this function only accepts bounded, schema-validated patches.
    """
    next_settings = runtime_settings.model_copy(deep=True)

    applied: list[str] = []
    skipped: list[str] = []
    conflicts: list[str] = []
    warnings: list[str] = []

    # Runtime context patches
    for patch in recap.runtimeContextUpdates:
        _set_runtime_context(
            next_settings,
            key=patch.key,
            value=patch.value,
            merge_policy=patch.mergePolicy,
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )

    # Scene patches
    scenes = _scene_index(next_settings)
    for patch in recap.scenePatches:
        scene = scenes.get(patch.sceneId)
        if scene is None:
            conflicts.append(f"scene:{patch.sceneId} not found in runtime_settings.sceneSeeds")
            continue
        scene.status = _merge_value(
            current=scene.status,
            incoming=patch.status,
            merge_policy=patch.mergePolicy,
            label=f"scene.{patch.sceneId}.status",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
        scene.objective = _merge_value(
            current=scene.objective,
            incoming=patch.objective,
            merge_policy=patch.mergePolicy,
            label=f"scene.{patch.sceneId}.objective",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
        scene.situation = _merge_value(
            current=scene.situation,
            incoming=patch.situation,
            merge_policy=patch.mergePolicy,
            label=f"scene.{patch.sceneId}.situation",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )

    # Encounter patches
    encounters = _encounter_index(next_settings)
    for patch in recap.encounterPatches:
        encounter = encounters.get(patch.encounterId)
        if encounter is None:
            conflicts.append(f"encounter:{patch.encounterId} not found in runtime_settings.encounterSeeds")
            continue
        merged_status = _merge_value(
            current=encounter.status,
            incoming=patch.status,
            merge_policy=patch.mergePolicy,
            label=f"encounter.{patch.encounterId}.status",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
        if merged_status is not None:
            encounter.status = merged_status

        merged_pressure = _merge_value(
            current=encounter.pressure,
            incoming=patch.pressure,
            merge_policy=patch.mergePolicy,
            label=f"encounter.{patch.encounterId}.pressure",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
        if merged_pressure is not None:
            encounter.pressure = merged_pressure

        merged_stakes = _merge_value(
            current=encounter.stakes,
            incoming=patch.stakes,
            merge_policy=patch.mergePolicy,
            label=f"encounter.{patch.encounterId}.stakes",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
        if merged_stakes is not None:
            encounter.stakes = merged_stakes

        merged_success = _merge_value(
            current=encounter.successAtCost,
            incoming=patch.successAtCost,
            merge_policy=patch.mergePolicy,
            label=f"encounter.{patch.encounterId}.successAtCost",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
        if merged_success is not None:
            encounter.successAtCost = merged_success

        merged_fallout = _merge_value(
            current=encounter.falloutOnFail,
            incoming=patch.falloutOnFail,
            merge_policy=patch.mergePolicy,
            label=f"encounter.{patch.encounterId}.falloutOnFail",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
        if merged_fallout is not None:
            encounter.falloutOnFail = merged_fallout

    # Location patches
    locations = _location_index(next_settings)
    for patch in recap.locationPatches:
        location = locations.get(patch.locationId)
        if location is None:
            conflicts.append(f"location:{patch.locationId} not found in runtime_settings.locationSeeds")
            continue
        merged_status = _merge_value(
            current=location.status,
            incoming=patch.status,
            merge_policy=patch.mergePolicy,
            label=f"location.{patch.locationId}.status",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
        if merged_status is not None:
            location.status = merged_status

        merged_summary = _merge_value(
            current=location.summary,
            incoming=patch.summary,
            merge_policy=patch.mergePolicy,
            label=f"location.{patch.locationId}.summary",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
        if merged_summary is not None:
            location.summary = merged_summary

        merged_region = _merge_value(
            current=location.region,
            incoming=patch.region,
            merge_policy=patch.mergePolicy,
            label=f"location.{patch.locationId}.region",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
        if merged_region is not None:
            location.region = merged_region

    # Clock patches
    clocks = _clock_index(next_settings)
    for patch in recap.clockPatches:
        clock = clocks.get(patch.clockId)
        if clock is None:
            conflicts.append(f"clock:{patch.clockId} not found in runtime_settings.clockSeeds")
            continue
        merged_status = _merge_value(
            current=clock.status,
            incoming=patch.status,
            merge_policy=patch.mergePolicy,
            label=f"clock.{patch.clockId}.status",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
        if merged_status is not None:
            clock.status = merged_status

        if patch.progress is not None:
            next_progress = max(0, min(int(clock.segments), int(patch.progress)))
            if next_progress != patch.progress:
                warnings.append(f"clock.{patch.clockId}.progress clamped to {next_progress}/{clock.segments}")
            merged_progress = _merge_value(
                current=clock.progress,
                incoming=next_progress,
                merge_policy=patch.mergePolicy,
                label=f"clock.{patch.clockId}.progress",
                conflicts=conflicts,
                applied=applied,
                skipped=skipped,
            )
            clock.progress = int(merged_progress)

        merged_trigger = _merge_value(
            current=clock.trigger,
            incoming=patch.trigger,
            merge_policy=patch.mergePolicy,
            label=f"clock.{patch.clockId}.trigger",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
        if merged_trigger is not None:
            clock.trigger = merged_trigger

        merged_consequence = _merge_value(
            current=clock.consequence,
            incoming=patch.consequence,
            merge_policy=patch.mergePolicy,
            label=f"clock.{patch.clockId}.consequence",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
        if merged_consequence is not None:
            clock.consequence = merged_consequence

    # Faction patches
    factions = _faction_index(next_settings)
    for patch in recap.factionPatches:
        faction = factions.get(patch.factionId)
        if faction is None:
            conflicts.append(f"faction:{patch.factionId} not found in runtime_settings.factionSeeds")
            continue

        merged_agenda = _merge_value(
            current=faction.agenda,
            incoming=patch.agenda,
            merge_policy=patch.mergePolicy,
            label=f"faction.{patch.factionId}.agenda",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
        if merged_agenda is not None:
            faction.agenda = merged_agenda

        merged_leader = _merge_value(
            current=faction.leaderName,
            incoming=patch.leaderName,
            merge_policy=patch.mergePolicy,
            label=f"faction.{patch.factionId}.leaderName",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
        if merged_leader is not None:
            faction.leaderName = merged_leader

        merged_resources = _merge_value(
            current=faction.resources,
            incoming=patch.resources,
            merge_policy=patch.mergePolicy,
            label=f"faction.{patch.factionId}.resources",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
        if merged_resources is not None:
            faction.resources = list(merged_resources)

    # Hook patches
    hooks = _hook_index(next_settings)
    for patch in recap.hookPatches:
        hook = hooks.get(patch.hookId)
        if hook is None:
            conflicts.append(f"hook:{patch.hookId} not found in runtime_settings.hookSeeds")
            continue

        merged_used = _merge_value(
            current=hook.used,
            incoming=patch.used,
            merge_policy=patch.mergePolicy,
            label=f"hook.{patch.hookId}.used",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
        if merged_used is not None:
            hook.used = bool(merged_used)

        merged_hidden = _merge_value(
            current=hook.hidden,
            incoming=patch.hidden,
            merge_policy=patch.mergePolicy,
            label=f"hook.{patch.hookId}.hidden",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
        if merged_hidden is not None:
            hook.hidden = bool(merged_hidden)

        merged_notes = _merge_value(
            current=hook.gmNotes,
            incoming=patch.gmNotes,
            merge_policy=patch.mergePolicy,
            label=f"hook.{patch.hookId}.gmNotes",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
        if merged_notes is not None:
            hook.gmNotes = merged_notes

        merged_content = _merge_value(
            current=hook.content,
            incoming=patch.content,
            merge_policy=patch.mergePolicy,
            label=f"hook.{patch.hookId}.content",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
        if merged_content is not None:
            hook.content = merged_content

    # Recap metadata traces in runtime context
    _set_runtime_context(
        next_settings,
        key="obsidian_last_recap_at",
        value=_now_iso(),
        merge_policy="replace",
        conflicts=conflicts,
        applied=applied,
        skipped=skipped,
    )
    _set_runtime_context(
        next_settings,
        key="obsidian_last_recap_session",
        value=recap.sessionId,
        merge_policy="replace",
        conflicts=conflicts,
        applied=applied,
        skipped=skipped,
    )
    if recap.recap.strip():
        _set_runtime_context(
            next_settings,
            key="obsidian_last_recap_summary",
            value=recap.recap.strip()[:240],
            merge_policy="replace",
            conflicts=conflicts,
            applied=applied,
            skipped=skipped,
        )
    _set_runtime_context(
        next_settings,
        key="obsidian_last_decision_count",
        value=str(len(recap.validatedDecisions)),
        merge_policy="replace",
        conflicts=conflicts,
        applied=applied,
        skipped=skipped,
    )

    # Re-validate through Pydantic to guarantee model consistency.
    next_settings = RuntimeSettings.model_validate(next_settings.model_dump(mode="json"))

    report = {
        "applied": applied,
        "skipped": skipped,
        "conflicts": conflicts,
        "warnings": warnings,
        "applied_count": len(applied),
        "skipped_count": len(skipped),
        "conflict_count": len(conflicts),
        "warning_count": len(warnings),
    }
    return next_settings, report
