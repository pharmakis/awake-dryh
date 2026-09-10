# AGENTS.md

## Project

**Awake — Unofficial Don't Rest Your Head System**

This repository contains an unofficial game system for **Foundry Virtual Tabletop**.

Target platform:

- Foundry VTT v14
- Modern Foundry APIs only

System ID:

- `awake-dryh`

Primary source language:

- English

Planned localization:

- English
- Russian

## Project Scope

This is a **Foundry Game System**, not a module for another game system.

The project should remain lightweight and focused on the mechanics needed for Don't Rest Your Head-style play.

Do not introduce unrelated subsystems, generic RPG abstractions, or unnecessary dependencies.

## Development Principles

- Prefer simple, readable code over clever abstractions.
- Keep files reasonably small and focused.
- Separate game-rule resolution from UI rendering.
- Keep dice-resolution logic testable outside the Foundry UI whenever possible.
- Avoid large monolithic classes.
- Avoid dependencies unless they provide a clear benefit and have been discussed first.
- Do not rewrite working architecture without an explicit reason.
- Do not silently change game mechanics.
- Do not invent rules to fill gaps in the source material.
- Ask for clarification when a mechanic or design decision is ambiguous.

## Foundry VTT

Use Foundry VTT v14 APIs and conventions.

Do not use deprecated APIs when a supported v14 alternative exists.

Use appropriate Foundry document types and DataModels.

The system should support at minimum:

- Player characters / Awake protagonists
- NPCs and Nightmares
- Discipline
- Exhaustion
- Madness
- Permanent Madness
- Pain
- Fight and Flight responses
- Hope
- Despair
- Exhaustion Talents
- Madness Talents

## Dice Resolution

The dice engine is a core part of the system and should be treated as independent domain logic.

Where practical:

- Keep success counting in pure functions.
- Keep dominance comparison in pure functions.
- Keep tie-breaking logic in pure functions.
- Add tests for edge cases.
- Do not couple dice evaluation to chat rendering.

A DRYH-style roll may contain separate pools for:

- Discipline
- Exhaustion
- Madness
- Pain

The system must preserve the distinction between:

1. Degree of success
2. Dominant pool

These are separate outcomes and must not be collapsed into a single result.

## Localization

Do not hard-code user-facing UI strings in JavaScript, templates, or HTML.

Use Foundry localization keys.

Use the namespace:

- `AWAKE.*`

English is the source language.

Russian localization should use the same localization keys.

## Character and Item Data

Prefer explicit structured data over opaque blobs.

Do not store derived values when they can be calculated reliably from canonical source data.

Talents should be represented as Foundry Items so that:

- they can be embedded in Actors;
- they can be stored in compendia;
- users can create custom talents;
- example talents can be distributed separately from copyrighted source material.

## Copyright and Content

Do not copy text, artwork, layout assets, illustrations, or other prepared content from:

- Don't Rest Your Head
- Don't Lose Your Mind
- other Evil Hat publications

The public repository should contain only:

- original code;
- original interface design;
- original example content;
- properly licensed third-party material.

Do not imply that the project is official or endorsed by Evil Hat Productions.

## AI-Assisted Development

AI-assisted software development is allowed for:

- code;
- refactoring;
- debugging;
- tests;
- technical documentation;
- CSS;
- software-generated SVG used as interface code.

Do not add AI-generated raster artwork, music, or other prepared creative assets to the core package intended for official Foundry listing.

## UI and Styling

The interface should feel atmospheric without depending on copyrighted art or heavy visual assets.

Prefer:

- HTML
- CSS
- typography
- gradients
- borders
- layout
- lightweight SVG where appropriate

Avoid making the default interface overtly sci-fi. The core system should remain broadly usable for different Don't Rest Your Head games.

## Git and Changes

Make focused changes.

Before making a broad architectural change:

1. explain the reason;
2. identify the files affected;
3. describe any migration or compatibility impact.

Do not modify unrelated files merely for cleanup.

Do not perform destructive git operations unless explicitly requested.

Do not rewrite git history.

## Agent Permissions

- Do not create commits unless explicitly requested.
- Do not push to remotes.
- Do not merge branches.
- Do not rewrite git history.
- Do not perform destructive git operations.
- Make code changes only in the working tree and leave review and commit decisions to the maintainer.

## Testing

Add tests for rules logic where feasible, especially:

- success counting;
- dominance resolution;
- dominance tie-breaking;
- Exhaustion changes;
- Madness consequences;
- Fight / Flight response handling;
- Snap conditions;
- Crash conditions.

Prefer deterministic tests over UI-dependent tests.

## Documentation

Keep technical documentation concise and current.

When behavior changes, update relevant documentation in the same change where practical.

Do not claim features are implemented until they actually work.