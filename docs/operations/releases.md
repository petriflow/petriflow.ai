# Releases

The project follows semantic versioning and publishes one artifact per tag: a Docker image, a runtime bundle, and a
GitHub Release. Documentation is published separately from the same repository.

## Versioning

`package.json` holds the version. A release is a `vX.Y.Z` tag that matches it exactly; the workflow rejects a tag whose
version differs, so a mistaken tag fails before anything is published.

- **Major** — breaking changes to tool names, arguments, or output shape
- **Minor** — new tools, resources, or rules
- **Patch** — fixes that keep every interface stable

Prereleases use a SemVer suffix such as `v1.1.0-rc.1`. They publish an image tag but do not move `latest`.

## Continuous integration

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`:

1. Install dependencies with `--frozen-lockfile`
2. Build (`xmcp build` + esbuild bundle)
3. Typecheck (`tsc --noEmit` over source and tests)
4. Test (`vitest run`)

The build runs before typecheck and tests because the generated `.xmcp/` adapter must exist for both.

## Cutting a release

1. Set the version in `package.json` and update `CHANGELOG.md`.
2. Commit and push to `main`.
3. Tag and push:

   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

4. Watch the **Release** workflow.

It performs the same build, typecheck, and test steps, then:

- validates that the tag matches `package.json` and that `DOCKERHUB_IMAGE` is configured
- builds the image and smoke-tests it: start the container, poll `/health`, fail on timeout
- packages the runtime bundle from the image's `/app`
- pushes the image, and also `latest` for stable versions
- creates the GitHub Release with generated notes and the bundle attached

## Repository settings

| Setting | Value |
|---|---|
| Variable `DOCKERHUB_IMAGE` | `netgrif/petriflow-mcp` or your image path |
| Secret `DOCKERHUB_USERNAME` | Docker Hub user that can push |
| Secret `DOCKERHUB_TOKEN` | Access token for that user |
| Branch protection | Require the CI check on `main` |
| Tag ruleset | Restrict `v*` creation to maintainers |

Missing settings fail the workflow early, before the image is built.

## Artifacts

| Artifact | Where | Contents |
|---|---|---|
| Docker image | `DOCKERHUB_IMAGE:X.Y.Z`, plus `latest` for stable | Application, production `node_modules`, Java 21, Groovy 4.0.33, bundled snapshot |
| Runtime bundle | GitHub Release asset `petriflow-mcp-vX.Y.Z-linux-alpine-node26.tar.gz` | `/app` from the image, including `server.cjs` and `node_modules` |
| Release notes | GitHub Release | Generated from merged pull requests |

The bundle targets Node 26 on Alpine (musl) and needs `libxml2`; the image is the supported artifact because it also
provides Java and Groovy.

## Documentation

The site in `docs/` is plain static files served by Docsify — no build step and no generated output. Publish the
directory with any static host, or point GitHub Pages at `docs/` on the default branch. `.nojekyll` keeps Pages from
running Jekyll over the files.

## Upgrade notes

Deployments pin an image tag. When upgrading:

- Check the release notes for renamed or removed tools and arguments.
- `PETRIFLOW_MODE` is `LOCAL` by default; a deployment that previously relied on the `REMOTE` default must set it
  explicitly.
- Keep the `storage/` volume; it is additive and never rewritten by an upgrade.
