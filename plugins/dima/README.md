# Dim / dima Agent plugin

This optional external ADP package and native dima plugin is not shipped or
registered by Presence. Choose `plugins/dima` through **Agents → Install local
plugin…**, then use **DimAgent → Setup** to obtain the installation command for
the managed copy. Reload dima afterwards.

The observer reports branch activity, approval waits and completed replies.
Native summaries use dima's auxiliary-model service and follow the reply-summary
trigger. Model overrides and OpenAI-compatible services are supported.

Version 0.2 adds managed event selection. **Setup** previews and saves activity
scenarios or individual events in `integrations/dimagent.json` beside the Presence
configuration. **⋯ → Remove integration…** can disable just approval/waiting,
reply collection, or failure reporting. Related events are selected together;
required lifecycle and cleanup callbacks stay enabled. Restart or reload dima
after changing the policy. Full host uninstallation uses dima's plugin manager,
as shown in the removal dialog.

The managed copy receives an SDK binding in `.adp-runtime.json`. The source folder
can be moved or removed afterwards. Disabling the plugin rejects events and
clears sessions. Removing the ADP package retains settings and dima files.
See [the package contract](../../docs/plugin-api.md).

The package uses the SDK supplied by the ADP managed copy. Loading `index.js`
directly from this checkout before installing it through ADP is unsupported.

## npm package workflow

With an npm-autoload-capable ADP build, a globally installed npm package is
recognized automatically. Install the published package with:

```sh
npm install -g adp-plugin-dima
```

To test a local checkout before publishing:

```sh
npm run pack -- dima
npm install -g ./dist/adp-plugin-dima-0.2.0.tgz
```

Run these commands from the repository root. ADP detects `adp-plugin-dima` and
adds the existing `dimagent` Agent within about ten seconds, retaining its normal
settings scope. Use Setup to install the ADP-managed copy into dima and reload it.
Do not install the unbound global npm folder directly into dima.

The tarball includes only its runtime files, manifest, icon, documentation and
license, with no machine-local SDK/config binding. Replacing the global package
with a newer release refreshes its managed copy; follow Setup and reload the host.
To stop npm discovery, remove it with `npm uninstall -g adp-plugin-dima`.
