# Troubleshooting

## A version is listed but its files cannot be read

`list-versions` reflects GitHub release metadata. Data tools and resources additionally require the matching release
asset `petriflow-vX.Y.Z.zip` to have been downloaded and installed. Ask the server administrator to inspect startup logs
or retry `POST /admin/petriflow/sync`.

The server deliberately has no bundled fallback data. It does not silently substitute files from another version.

## `latest` cannot be resolved

The server populates its version cache during startup synchronization. If GitHub could not be reached before the first
successful sync, restart after connectivity is restored or ask the administrator to call the sync endpoint. Use an
explicit version only if its release data is already installed.

## Process validation fails

- Check that the XML is well formed and uses the correct `version`.
- Review the `issues` array for `xml`, `xsd`, or semantic rule identifiers.
- The server needs the XSD for that version in local storage.

## Action validation is unavailable

`validate-action` uses a persistent Groovy process. The server runtime needs a JVM and Groovy on `PATH`;
see [Installation and configuration](../admin/installation-and-config.md). Compilation does not execute the action.
