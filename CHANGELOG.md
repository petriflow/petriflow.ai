# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `components-definitions.json` in release archives is now validated when present and optional when absent, so
  `list_components` and `get_component` serve it for versions that publish it.
- The LOCAL snapshot install warns when its version is already stored instead of silently keeping the stored files.

### Changed

- `PETRIFLOW_MODE` now defaults to `LOCAL`, using the bundled snapshot without contacting GitHub. `REMOTE` is opt-in
  while `petriflow/petriflow` releases do not publish `petriflow-vX.Y.Z.zip` assets. Set `PETRIFLOW_MODE=REMOTE` to
  keep the previous default behavior; `POST /admin/petriflow/sync` now returns HTTP 409 unless REMOTE is set.
- `list_components` returns an empty list and `get_component` reports that components are not available for versions
  whose archive does not publish component definitions, instead of failing with a missing-file error.

## [1.0.0] - 2026-11-01

### Added

- MCP server over HTTP with 13 Petriflow tools, 11 resources, process validation, and Groovy action validation.
- LOCAL snapshot mode and REMOTE release synchronization with an admin sync endpoint.
- CI/CD workflows, Docker image, and a runtime bundle published with each GitHub Release.
- Startup feature flags for validation rules and tools.

### Changed

- Runtime upgraded to Node.js 26 and XML validation moved to the native `libxmljs5` module.
