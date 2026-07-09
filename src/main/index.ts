import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { registerKeyHandlers } from './ipc/registerKeyHandlers'
import { registerModelHandlers } from './ipc/registerModelHandlers'
import { registerGenerationHandlers } from './ipc/registerGenerationHandlers'
import { registerChatHandlers } from './ipc/registerChatHandlers'
import { registerSystemHandlers } from './ipc/registerSystemHandlers'

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerKeyHandlers()
  registerModelHandlers()
  registerGenerationHandlers()
  registerChatHandlers()
  registerSystemHandlers()

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
