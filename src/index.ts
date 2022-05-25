import net from 'net'
import util from 'util'
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
  hostname: string
}

type StopServer =
  | (() => Promise<void>)
  | undefined

let button: ControlButton
let stopServer: StopServer

export function deactivate(): void {
  void stopLiveReloadServer()
  button?.dispose()
}

export function activate({ subscriptions }: vscode.ExtensionContext): void {

  button = new ControlButton()

  const { hostname, port: preferredPort, ...config } =
    vscode.workspace.getConfiguration('liveReloadServer') as unknown as Config

  subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor?.document.languageId === 'html') return button.show()
    if (stopServer == null) return button.hide()
  }))

  subscriptions.push(vscode.commands.registerCommand('livereload-server.openDocument', async uri => {
    await stopLiveReloadServer()
    uri ??= vscode.window.activeTextEditor?.document.uri
    const folder = vscode.workspace.getWorkspaceFolder(uri)?.uri.path as string
    const port = await getNextAvailablePort(preferredPort)
    stopServer = await createLiveReloadServer({ ...config, port, folder })
    button.start(port)
    const pathname = path.relative(folder, uri.fsPath)
    const browserUrl = vscode.Uri.parse(`http://${hostname}:${port}/${pathname}`)
    if (!(await vscode.env.openExternal(browserUrl))) {
      void vscode.window.showInformationMessage(`LiveReload Server is running at ${browserUrl}`)
    }
  }))

  subscriptions.push(vscode.commands.registerCommand('livereload-server.openFolder', async uri => {
    await stopLiveReloadServer()
    const port = await getNextAvailablePort(preferredPort)
    stopServer = await createLiveReloadServer({ ...config, port, folder: uri.path })
    button.start(port)
    const browserUrl = vscode.Uri.parse(`http://${hostname}:${port}/`)
    if (!(await vscode.env.openExternal(browserUrl))) {
      void vscode.window.showInformationMessage(`LiveReload Server is running at ${browserUrl}`)
    }
  }))

  subscriptions.push(vscode.commands.registerCommand('livereload-server.stop', async () => {
    await stopLiveReloadServer()
    button.stop(vscode.window.activeTextEditor?.document.languageId !== 'html')
  }))

  button.init(vscode.window.activeTextEditor?.document.languageId === 'html')
}

type ServerConfig = Pick<Config, 'port' | 'delay'> & {
  folder: string
}

async function stopLiveReloadServer(): Promise<void> {
  try {
    await stopServer?.()
  } finally {
    stopServer = undefined
  }
}

async function createLiveReloadServer(config: ServerConfig): Promise<StopServer> {

  const { folder, port, delay } = config

  const handler = express()
    .use(connectLiveReload({ port }))
    .use(express.static(folder))
    .use(serveIndex(folder, {
      template: path.join(require.resolve('serve-index'), '..', 'public', 'directory.html'),
      stylesheet: path.join(require.resolve('serve-index'), '..', 'public', 'style.css')
    }))
    .use((req, res, next) => {
      req.path === '/livereload.js'
        ? res.sendFile(require.resolve('livereload-js'))
        : next()
    })

  const server = shutdown(http.createServer(handler))
  const livereload = createServer({ server, port, delay, noListen: true })

  return new Promise((resolve, reject) => {
    server.once('error', () => server.shutdown(reject))
    server.once('close', () => livereload.watcher.close())
    server.once('listening', () => resolve(util.promisify(server.forceShutdown)))
    livereload.watch(folder)
    livereload.listen()
  })
}

async function getNextAvailablePort(port: number): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server: net.Server = net
      .createServer()
      .on('error', (err: NodeJS.ErrnoException) => {
        err.code === 'EADDRINUSE'
          ? server.listen(++port)
          : reject(err)
      })
      .once('listening', () => server.close(() => resolve(port)))
      .listen(port)
  })
}

class ControlButton {

  ui = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)

  init(show: boolean): void {
    this.ui.text = '$(broadcast) LiveReload'
    this.ui.command = 'livereload-server.openDocument'
    this.ui.tooltip = 'Open with LiveReload Server'
    show ? this.show() : this.hide()
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
    this.ui.tooltip = 'Stop LiveReload Server'
  }

  stop(hide: boolean): void {
    this.init(!hide)
  }

  dispose(): void {
    this.ui.dispose()
  }

}
