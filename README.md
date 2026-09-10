# Awake — Unofficial Don't Rest Your Head System

An unofficial Foundry VTT game system for **Don't Rest Your Head** by Fred Hicks / Evil Hat Productions.

Awake is intended to provide a lightweight, focused implementation of the core mechanics of Don't Rest Your Head for Foundry VTT, including character sheets, dice pools, Pain, Exhaustion, Madness, Responses, Hope and Despair.

## Status

Early development. The repository contains a minimal system manifest and English localization infrastructure. Sheets, game data models, and mechanics are not implemented yet.

The project is currently targeting **Foundry VTT v14**.

## Goals

- Provide a clean and usable character sheet for Awake protagonists.
- Support Discipline, Exhaustion, Madness and Pain dice pools.
- Automate success counting and dominance resolution.
- Support Fight / Flight response tracking.
- Support Hope and Despair as shared game resources.
- Support Exhaustion Talents and Madness Talents.
- Provide lightweight NPC / Nightmare support based around Pain.
- Keep the system small, readable and easy to maintain.
- Support localization from the beginning.

## Content and Copyright

This project is an **unofficial fan-made implementation** and is not affiliated with or endorsed by Evil Hat Productions.

Don't Rest Your Head and Don't Lose Your Mind are copyrighted works of Evil Hat Productions and their respective authors.

This repository does not include copyrighted text, artwork or other assets taken from the published books.

Any example characters, talents or other game content included with Awake will be original material created specifically for this project.

## AI-Assisted Development

Software development for this project may use AI-assisted tools for coding, debugging, refactoring, testing and technical documentation.

The project does not include AI-generated artwork, music or other prepared creative assets in the core package.

## License

The source code of Awake is released under the MIT License.

See [LICENSE](LICENSE) for details.

## Development

For local installation, copy this repository into your Foundry user data directory as `Data/systems/awake-dryh`, then restart Foundry. The installed folder must be named `awake-dryh` to match the system ID. In Foundry VTT v14, create a world and select **Awake — Unofficial Don't Rest Your Head System**.

English localization lives in `lang/en.json` under the `AWAKE` namespace. The manifest targets v14; runtime compatibility has not yet been verified in Foundry.

Repository:

`awake-dryh`

System ID:

`awake-dryh`

Primary development language:

English

Planned localization:

- English
- Russian
