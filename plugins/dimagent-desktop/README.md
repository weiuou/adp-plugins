# DimAgent Desktop

An external ADP package for the **DimAgent desktop client**, using its command
hooks. This is separate from the Rust alpha `dima` package in `../dima`.
The ADP ID is `dimagent-desktop` and its display name is **DimAgent Desktop**;
the two packages can be installed together and keep independent settings.

## Installation

1. In ADP, choose **Agents → Install local plugin…** and select this folder.
2. Open **DimAgent Desktop → Setup**, select events and apply the policy.
3. Copy the command in **Manual configuration**. It runs
   `dim plugin install <ADP-managed-package-path>` to install the managed copy.
4. Reload DimAgent and open a new session. Use its hooks management to review
   the commands if the client requests trust.

`dim` is the desktop-compatible TypeScript CLI, not the Rust alpha `dima`.
If it is not on PATH, replace `dim` in the generated command with the bundled
desktop CLI. Its Windows location is
`%LOCALAPPDATA%\Programs\DimAgent\resources\runtime\cli\dim.exe`.
Node.js 22+ must also be available as `node` to the desktop application.

Install the ADP package first: its generated `.adp-runtime.json` binding must
be included in the copy installed into DimAgent. Do not install the source
checkout directly into DimAgent before this step.

## Behavior and limits

- Session start and reply stop report idle. Prompts, tools and compaction report
  working. Permission requests report waiting; a completed tool restores working.
- A child-session stop closes the child's activity, leaving the parent intact.
- **Remove integration…** in ADP disables optional events through the package's
  policy. Required lifecycle and restoration events remain selected. The hook
  reads that policy on each invocation, so policy edits require no host reload.
- Prompts, tool arguments, tool output and workspace paths are never sent to ADP.
- An unavailable ADP service or invalid hook input leaves the host unaffected.
  The hook emits no output and never supplies permission decisions or instructions.

Compatibility was checked against the installed **DimAgent Desktop 0.9.63**
plugin and command-hook contracts. That version does not expose `SessionEnd`,
interrupt, model-response text or failure events through its command-hook API.
Main-session cleanup therefore uses ADP's configured stale-session timeout;
this package does not claim automatic reply summaries or immediate cleanup when
a conversation tab closes. A denied approval may remain waiting until the next
prompt, tool completion or stop event. These are host API limits.

The client controls how it launches hook commands. This package uses Node
directly and launches no additional shell or persistent background worker.

## Update and removal

Update by reinstalling the package in ADP and then installing its new managed
copy into DimAgent. Saved ADP settings remain available.
For full removal, use DimAgent's plugin manager to remove
`agent-discord-presence-desktop`, then reload the client. Remove the ADP package
separately if it is no longer needed. ADP package removal retains host-side files.
