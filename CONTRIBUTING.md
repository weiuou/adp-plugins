# Adding an ADP plugin

1. Create a directory under `plugins/<host>/` containing a complete `adp-plugin.json` package. Name its npm package `adp-plugin-<host>` (for example, `adp-plugin-dima`). This naming rule applies to all packages in this collection; the stable ADP ID is a separate field.
2. Give it a stable, unique ADP ID. Keep that ID across updates so existing per-agent settings remain usable.
3. Include host-side entry files and installation, reload, update, and removal instructions in the package README. Declare host installation commands and translations in the manifest.
4. Add the package to `catalog.json`; keep its ID, path, and version consistent with the manifest.
5. Run `npm run check`, install the folder through ADP, and check activity reporting and cleanup in the host. Include focused integration coverage when the host's lifecycle requires it.

Packages use the SDK supplied by ADP's managed installation. Do not copy the ADP daemon into a plugin or rely on a sibling source checkout. `.adp-runtime.json` is generated locally by ADP and must never be committed. Keep credentials, local settings, machine-specific paths, and installed runtime bindings out of the repository.

Optional event policies must preserve required lifecycle and cleanup callbacks. A host adapter must honor the SDK's `adapterEvents(id)` selection after reload, including when optional reply collection or approval reporting is disabled.

See [the package API](docs/plugin-api.md) for the manifest fields and limits. Adding another plugin should not require changes in ADP core.
