# Contributing

Thanks for helping improve visdiff. See the [roadmap](docs/ROADMAP.md) for planned work.

## Setup

Requires Node.js `^20.19.0 || >=22.12.0` and npm.

```bash
npm ci
npm run check
```

`npm run check` runs ESLint, TypeScript, and the package tests. Please also run `npm run build` and `npm run docs:build` when your change touches the package build or the documentation.

## Making a change

1. Open an issue first for larger features or behavior changes.
2. Keep changes focused; avoid unrelated refactors.
3. Add or update tests in `packages/visdiff/test/` for new behavior.
4. Update the docs in `docs/` and the READMEs when user-facing behavior changes.
5. Add a line to the `Unreleased` section of [CHANGELOG.md](CHANGELOG.md).

Visdiff does not patch source code; it captures visual intent for an agent. Changes should preserve that principle and keep the task format backward compatible (new fields optional).

## Project layout

See [docs/guide/development.md](docs/guide/development.md) for the main source areas and the documentation site.

## Pull requests

Describe what changed and why, and confirm `npm run check` passes. CI runs the same checks on supported Node.js versions.
