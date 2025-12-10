import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import fs from 'node:fs/promises'
// import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { spawn } from 'node:child_process'

// const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Open DevTools in development mode
  if (VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools()
  }

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()

  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
    })
    if (canceled) {
      return null
    }
    return filePaths[0]
  })

  ipcMain.handle('fs:readDirectory', async (_, dirPath) => {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      return entries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        path: path.join(dirPath, entry.name),
      }))
    } catch (error) {
      console.error('Failed to read directory:', error)
      return []
    }
  })

  ipcMain.handle('fs:readFile', async (_, filePath) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      console.error('Failed to read file', error);
      return null;
    }
  })

  // For binary files like DWG
  ipcMain.handle('fs:readBinaryFile', async (_, filePath) => {
    try {
      const buffer = await fs.readFile(filePath);
      return buffer;
    } catch (error) {
      console.error('Failed to read binary file', error);
      return null;
    }
  })

  // FEA Analysis
  ipcMain.handle('fea:run', async (_, data: any) => {
    return new Promise((resolve, reject) => {
      const pythonScriptPath = path.join(process.env.APP_ROOT, 'python', 'adapter.py');
      // TODO: Make python path configurable
      const pythonProcess = spawn('python3', [pythonScriptPath]);

      let resultData = '';
      let errorData = '';

      pythonProcess.stdout.on('data', (chunk: any) => {
        resultData += chunk.toString();
      });

      pythonProcess.stderr.on('data', (chunk: any) => {
        errorData += chunk.toString();
      });

      pythonProcess.on('close', (code: any) => {
        if (code !== 0) {
          console.error(`FEA process exited with code ${code}`);
          console.error(`Error output: ${errorData}`);
          reject(new Error(`FEA Analysis failed: ${errorData}`));
          return;
        }

        try {
          const result = JSON.parse(resultData);
          resolve(result);
        } catch (e) {
          console.error('Failed to parse FEA result', e);
          reject(new Error(`Failed to parse analysis result: ${e}`));
        }
      });

      // Send input data to Python script
      pythonProcess.stdin.write(JSON.stringify(data));
      pythonProcess.stdin.end();
    });
  })
})
