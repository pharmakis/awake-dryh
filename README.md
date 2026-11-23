## What is Awake?

Awake is a custom game system for **Foundry Virtual Tabletop v14**.

It provides character management and automation for the main mechanics used during play, reducing manual bookkeeping while keeping the game itself at the table.

<p align="center">
  <img src="docs/screenshots/actor-sheet-overview.png"
       alt="Awake character sheet in Foundry VTT"
       width="1100">
</p>

## Features

### Character Sheet

A dedicated character sheet includes:

- character identity and narrative Questions;
- Discipline, Exhaustion, and Permanent Madness;
- Fight and Flight Responses;
- Hope and Despair;
- Talents;
- Gear;
- Scars.

Character state is updated automatically when relevant mechanics are resolved.

<p align="center">
  <img src="docs/screenshots/actor-sheet-details.png"
       alt="Talents, Gear, and Scars"
       width="1100">
</p>

### Talents

Exhaustion and Madness Talents are implemented as separate Foundry Items with dedicated sheets.

Madness Talents support multiple power levels, Fight and Flight effects, and character transformation fields.

<p align="center">
  <img src="docs/screenshots/madness-talent-sheet.png"
       alt="Madness Talent sheet"
       width="1100">
</p>

### Conflict Resolution

The system supports the complete conflict workflow:

- starting a conflict and setting Pain;
- building the protagonist's dice pool;
- rolling Discipline, Exhaustion, Madness, and Pain;
- calculating success and dominance;
- spending Hope and Despair;
- finalizing the result;
- applying dominance consequences;
- applying additional consequences after failed conflicts.

<p align="center">
  <img src="docs/screenshots/build-roll.png"
       alt="Building a conflict roll"
       width="1100">
</p>

<p align="center">
  <img src="docs/screenshots/conflict.png"
       alt="Resolved conflict in Foundry chat"
       width="1100">
</p>

### Consequences and Character State

Awake tracks and automates the mechanical effects of conflicts, including:

- Discipline recovery;
- Exhaustion increases;
- Fight and Flight Responses;
- Crash;
- Snap;
- temporary Recovery state;
- Permanent Madness.

<p align="center">
  <img src="docs/screenshots/madness-consequence.png"
       alt="Applying a Madness consequence"
       width="1100">
</p>

### Shared Resources

Hope and Despair are stored as shared world resources and can be accessed from character sheets and conflict controls.

### Other Features

- Gear management
- Scar tracking
- Foundry permissions for GM and player actions
- Multiplayer support
- English localization
- Custom sheets, dialogs, and chat cards

## Technical Overview

Built with JavaScript for **Foundry VTT v14**, using custom Actor and Item data models, ApplicationV2 sheets, Handlebars templates, localization, and Foundry's multiplayer APIs.