import path from 'path'
import http from 'http'
import vscode from 'vscode'
import express from 'express'
import serveIndex from 'serve-index'
import shutdown from 'http-shutdown'
import connectLiveReload from 'connect-livereload'
import { createServer } from 'livereload'

let closeServer: (() => Promise<void>) | undefined

export function deactivate(): void {
  closeServer?.()
}

export function activate({ subscriptions }: vscode.ExtensionContext): void {

  subscriptions.push(vscode.commands.registerCommand('livereload-server.open', async uri => {
    closeServer = await closeServer?.() ?? undefined
    uri ??= vscode.window.activeTextEditor?.document.uri
    const folder = vscode.workspace.getWorkspaceFolder(uri)?.uri.path
    if (folder == null) return
    const urlPath = path.relative(folder, uri.fsPath)
    closeServer = await createLiveReloadServer({ folder, port: 5500, delay: 100 })
    void vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`http://localhost:${5500}/${urlPath}`))
  }))

  subscriptions.push(vscode.commands.registerCommand('livereload-server.stop', async () => {
    closeServer = await closeServer?.() ?? undefined
  }))
}

type LiveReloadServerConfig = {
  folder: string
  port: number
  delay: number
}

async function createLiveReloadServer(config: LiveReloadServerConfig): Promise<() => Promise<void>> {

  const { folder, port, delay } = config

  const handler = express()
    .use(connectLiveReload({ port }))
    .use(express.static(folder))
    .use(serveIndex(folder, { icons: true }))
    .use((req, res, next) => {
      if (req.path === '/livereload.js') {
        res.sendFile(require.resolve('livereload-js'))
        return
      }
      next()
    })

  const server = shutdown(http.createServer(handler))
  const livereload = createServer({ server, port, delay, noListen: true })

  return new Promise((resolve, reject) => {
    livereload.listen(() => {
      livereload.watch(folder)
      livereload.server.on('error', reject)
      livereload.server.once('connection', () => {
        setTimeout(() => livereload.sendAllClients(JSON.stringify({
          command: 'reload',
          path: '*'
        })), 250)
      })
      resolve(() => new Promise((resolve, reject) => {
        server.shutdown(err => err != null ? reject(err) : resolve())
      }))
    })
  })
}
