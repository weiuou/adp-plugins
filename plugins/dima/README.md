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
