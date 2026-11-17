# ADP plugins

External plugins for [Agent Discord Presence (ADP)](https://github.com/weiuou/agent-discord-presence). Each plugin lives in its own directory and is installed explicitly through ADP's existing **Agents** page.

## Available plugins

| Host | Plugin | ADP ID | Package folder |
| --- | --- | --- | --- |
| dima / Dim Rust alpha | [DimAgent](plugins/dima/README.md) | `dimagent` | `plugins/dima` |

This repository can host plugins for other agents. Built-in ADP integrations, including Pi, continue to use their existing installation paths.

## Install

Use an ADP build that supports external Agent plugins. The implementation is currently available on [`feat/agent-plugins`](https://github.com/weiuou/agent-discord-presence/tree/feat/agent-plugins), starting with commit `92d1b4f`.

1. Clone this repository, or download and extract its source ZIP:

   ```sh
   git clone https://github.com/weiuou/adp-plugins.git
   ```

2. In ADP, open **Agents → Install local plugin…** and select the individual package folder, such as `adp-plugins/plugins/dima`.
3. Open that Agent's **Setup** dialog to select events and apply its Presence policy.
4. Follow **Manual configuration** to install the managed copy into the host, then reload or restart the host.

ADP copies each installed package into its configuration directory and supplies its runtime SDK binding. The source checkout does not need to stay in place. Install the ADP package before loading its native host entry.

To update a package, remove it from ADP and install the updated folder, then follow Setup again to point the host at the new managed copy. Removing an ADP package retains saved settings and host-side files; use **Remove integration…** and the host's plugin manager when those should also be removed.

`catalog.json` lists the available packages. It is an inventory for this repository, not an automatic download or installation feed.

## Development

Node.js 22+ is required for the checks. No npm dependencies or compilation are needed:

```sh
npm run check
```

The dima integration tests use a separately built, plugin-capable ADP checkout. In PowerShell:

```powershell
$env:ADP_SOURCE_DIR = '<path-to-agent-discord-presence>'
npm run test:integration
```

Build that checkout with `npm run build` first. On POSIX shells, use `ADP_SOURCE_DIR=/path/to/agent-discord-presence npm run test:integration`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for adding plugins and [the package API](docs/plugin-api.md) for the manifest and SDK contract.

## License

MIT. The ADP runtime and SDK are provided by Agent Discord Presence; their existing attribution is retained in [LICENSE](LICENSE).
