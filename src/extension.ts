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

let button: Button
let stopServer: StopServer

export function deactivate(): void {
  stopServer?.()
  button.dispose()
}

export function activate({ subscriptions }: vscode.ExtensionContext): void {

  button = new Button()

  const { port: preferredPort, ...config } =
    vscode.workspace.getConfiguration('liveReloadServer') as unknown as Config

  subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor?.document.languageId === 'html') {
      button.show()
    } else if (stopServer == null) {
      button.hide()
    }
  }))

  subscriptions.push(vscode.commands.registerCommand('livereload-server.openDocument', async uri => {
    stopServer = await stopServer?.() ?? undefined
    uri ??= vscode.window.activeTextEditor?.document.uri
    const folder = vscode.workspace.getWorkspaceFolder(uri)?.uri.path as string
    const port = await getNextAvailablePort(preferredPort)
    stopServer = await createLiveReloadServer({ ...config, port, folder })
    button.start(port)
    const pathname = path.relative(folder, uri.fsPath)
    const browserUrl = vscode.Uri.parse(`http://localhost:${port}/${pathname}`)
    if (!(await vscode.env.openExternal(browserUrl))) {
      void vscode.window.showInformationMessage(`LiveReload Server is running at ${browserUrl}`)
    }
  }))

  subscriptions.push(vscode.commands.registerCommand('livereload-server.openFolder', async uri => {
    stopServer = await stopServer?.() ?? undefined
    const folder = uri.path
    const port = await getNextAvailablePort(preferredPort)
    stopServer = await createLiveReloadServer({ ...config, port, folder })
    button.start(port)
    const pathname = path.relative(folder, uri.fsPath)
    const browserUrl = vscode.Uri.parse(`http://localhost:${port}/${pathname}`)
    if (!(await vscode.env.openExternal(browserUrl))) {
      void vscode.window.showInformationMessage(`LiveReload Server is running at ${browserUrl}`)
    }
  }))

  subscriptions.push(vscode.commands.registerCommand('livereload-server.stop', async () => {
    stopServer = await stopServer?.() ?? undefined
    button.stop()
    if (vscode.window.activeTextEditor?.document.languageId !== 'html') {
      button.hide()
    }
  }))

  if (vscode.window.activeTextEditor?.document.languageId === 'html') {
    button.show()
  }
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

class Button {

  ui: vscode.StatusBarItem

  constructor() {
    this.ui = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
    this.ui.text = '$(broadcast) Go Live'
    this.ui.command = 'livereload-server.openDocument'
    this.ui.tooltip = 'Click to run LiveReload Server'
  }

  show(): void {
    this.ui.show()
  }

  hide(): void {
    this.ui.hide()
  }

  start(port: number): void {
    this.ui.text = `$(circle-slash) Port : ${port}`
    this.ui.command = 'livereload-server.stop'
    this.ui.tooltip = 'Click to stop LiveReload Server'
  }

  stop(): void {
    this.ui.text = '$(broadcast) Go Live'
    this.ui.command = 'livereload-server.openDocument'
    this.ui.tooltip = 'Click to run LiveReload Server'
  }

  dispose(): void {
    this.ui.dispose()
  }

}
