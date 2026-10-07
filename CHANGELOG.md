# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- `visdiff status` prints a one-line summary of each pending task.
- `visdiff clear --all` clears the whole queue explicitly.
- **Copy prompt** button in the overlay copies the pending batch as plain text for any agent.
- Tasks carry `schemaVersion` (currently `1`); older tasks without it are read as version 1.
- Tailwind CSS detection adds styling guidance to `visdiff instructions` and `visdiff_pending_tasks`.
- Tasks include `element.classes`, and in Tailwind projects `visdiff tasks` and the MCP tool add per-edit `tailwind` class suggestions (`suggestion`, `exact`, `alternative`, `replaces`), using the project's theme (v3 config spacing/width/height, v4 `@theme` tokens and `--spacing` unit).
- Tests for client model logic, status output, and styling detection.
- [Roadmap](docs/ROADMAP.md).

### Changed

- `packages/visdiff/dist/` is no longer tracked in git; it is still included in the published package.

## [0.1.0]

- Initial release: Vite overlay for select, move, resize, multi-select and Flex/Grid layout edits; source anchors for React, Vue and Svelte; task queue in `.visdiff/tasks.json`; CLI and MCP interfaces.
