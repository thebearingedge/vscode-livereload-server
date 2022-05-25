# livereload-server-vscode

[![Visual Studio Marketplace](https://vsmarketplacebadge.apphb.com/version/thebearingedge.livereload-server.svg)](https://marketplace.visualstudio.com/items?itemName=thebearingedge.livereload-server)

Just LiveReload. For Visual Studio Code.

## Simple

- Auto-refreshes when watched folder changes.
- "Hot" reloads linked CSS.
- Pick any HTML document to use its containing workspace as the server root.
- Pick any folder as the server root. Serves a simple file explorer when no `index.html` is present.

## Getting Started

1. [Install the extension](https://marketplace.visualstudio.com/items?itemName=thebearingedge.livereload-server).
1. Open a project in VS Code.
1. Go live in one of three ways:
    - Click the **LiveReload button** while an HTML document is open.
    - **Right-click a folder** to open it with LiveReload.
    - Use **the command palette** while an HTML document is open.

## Settings

| Value      | Details                                                                                           | Default     |
| ---------- | ------------------------------------------------------------------------------------------------- | ----------- |
| `liveReloadServer.port`     | The port on which LiveServer will listen. If unavailable, the next available port will be chosen. | `5500`      |
| `liveReloadServer.hostname` | Customize the hostname to auto-open in the browser.                                               | `"localhost"` |
| `liveReloadServer.delay`    | An arbitrary amount of time to wait after a file is saved before triggering a reload.             | `100`       |

## Demo

![Interpolated Values](https://raw.githubusercontent.com/thebearingedge/livereload-server-vscode/main/images/livereload-server.gif)
