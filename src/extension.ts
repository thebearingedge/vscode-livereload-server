import * as http from 'http'
import * as vscode from 'vscode'
import * as express from 'express'
import * as serveIndex from 'serve-index'
import * as connectLiveReload from 'connect-livereload'
import { createServer, LiveReloadServer } from 'livereload'

let livereload: LiveReloadServer | undefined

export function deactivate(): void {
  livereload?.close()
}

export function activate({ subscriptions }: vscode.ExtensionContext): void {

  subscriptions.push(vscode.commands.registerCommand('livereload-server.open', async () => {

    livereload?.close()

    const workspace = vscode.workspace.workspaceFolders?.[0].uri.fsPath

    if (workspace == null) return

    livereload ??= await createLiveReloadServer({ workspace, port: 5500, delay: 100 })

    livereload.watch(workspace)

    livereload.listen(() => {
      livereload?.server.once('connection', () => {
        setTimeout(() => livereload?.sendAllClients(JSON.stringify({
          command: 'reload',
          path: '/'
        })), 100)
      })
      void vscode.window.showInformationMessage('livereload-server.open')
    })
  }))

  subscriptions.push(vscode.commands.registerCommand('livereload-server.close', async () => {
    livereload = livereload?.close() ?? undefined
    void vscode.window.showInformationMessage('livereload-server.close')
  }))
}

type LiveReloadServerConfig = {
  workspace: string
  port: number
  delay: number
}

async function createLiveReloadServer(config: LiveReloadServerConfig): Promise<LiveReloadServer> {

  const { workspace, port, delay } = config

  const handler = express()
    .use(connectLiveReload({ port }))
    .use(express.static(workspace))
    .use(serveIndex(workspace, { icons: true }))
    .use((req, res, next) => {
      if (req.path === '/livereload.js') {
        res.sendFile(require.resolve('livereload-js'))
        return
      }
      next()
    })

  const server = http.createServer(handler)

  return createServer({ server, port, delay, noListen: true })
}
