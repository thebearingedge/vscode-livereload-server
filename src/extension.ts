import net from 'net'
import path from 'path'
import http from 'http'
import vscode from 'vscode'
import express from 'express'
import serveIndex from 'serve-index'
import shutdown from 'http-shutdown'
import { createServer } from 'livereload'
import connectLiveReload from 'connect-livereload'

type Config = {
  port: number
  delay: number
}

type StopServer =
  | (() => Promise<void>)
  | undefined

let stopServer: StopServer

export function deactivate(): void {
  stopServer?.()
}

export function activate({ subscriptions }: vscode.ExtensionContext): void {

  const { port: preferredPort, ...config } =
    vscode.workspace.getConfiguration('liveReloadServer') as unknown as Config

  subscriptions.push(vscode.commands.registerCommand('livereload-server.open', async uri => {
    stopServer = await stopServer?.() ?? undefined
    uri ??= vscode.window.activeTextEditor?.document.uri
    const folder = vscode.workspace.getWorkspaceFolder(uri)?.uri.path
    if (folder == null) return
    const port = await getNextAvailablePort(preferredPort)
    stopServer = await createLiveReloadServer({ ...config, port, folder })
    const pathname = path.relative(folder, uri.fsPath)
    const browserUrl = vscode.Uri.parse(`http://localhost:${port}/${pathname}`)
    void vscode.commands.executeCommand('vscode.open', browserUrl)
  }))

  subscriptions.push(vscode.commands.registerCommand('livereload-server.stop', async () => {
    stopServer = await stopServer?.() ?? undefined
  }))
}

type ServerConfig = Config & {
  folder: string
}

async function createLiveReloadServer(config: ServerConfig): Promise<StopServer> {

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
    livereload.watch(folder)
    server.once('error', err => {
      livereload.close()
      reject(err)
    })
    livereload.listen(() => {
      resolve(() => new Promise((resolve, reject) => {
        livereload.watcher.close()
        server.shutdown(err => err != null ? reject(err) : resolve())
      }))
    })
  })
}

async function getNextAvailablePort(preferredPort: number): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server: net.Server = net
      .createServer()
      .on('error', (err: NodeJS.ErrnoException) => {
        err.code === 'EADDRINUSE' ? server.listen(++preferredPort) : reject(err)
      })
      .once('listening', () => server.close(() => resolve(preferredPort)))
      .listen(preferredPort)
  })
}
