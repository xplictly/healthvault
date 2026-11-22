const { app, BrowserWindow, shell, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

const isMac = process.platform === 'darwin';
let backendProcess;
let frontendProcess;

function isPortServing(port) {
  return new Promise((resolve) => {
    const http = require('http');
    const request = http.get({ host: '127.0.0.1', port, path: '/', timeout: 700 }, (response) => {
      response.resume();
      resolve(true);
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

async function ensureDevelopmentServices() {
  const workspaceRoot = path.resolve(__dirname, '..');
  if (!(await isPortServing(5001))) {
    backendProcess = runScript('npm run dev', path.join(workspaceRoot, 'vault-backend'), 'HealthVault backend');
    await waitForPort(5001);
  }
  if (!(await isPortServing(3000))) {
    frontendProcess = runScript('npm run dev', __dirname, 'HealthVault frontend');
  }
  await waitForPort(3000);
}

function waitForPort(port, attempts = 50) {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (await isPortServing(port)) return resolve(true);
      if (attempts <= 0) return reject(new Error(`Service on port ${port} did not become ready.`));
      attempts -= 1;
      setTimeout(poll, 200);
    };
    poll();
  });
}

function runScript(command, cwd, label) {
  const child = spawn(command, {
    cwd,
    shell: true,
    env: { ...process.env, FORCE_COLOR: '0' },
    stdio: 'ignore',
  });
  child.on('error', (error) => console.error(`${label} failed to start:`, error));
  return child;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 390,
    minHeight: 700,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    backgroundColor: '#000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  window.loadURL('http://localhost:3000');
}

app.whenReady().then(async () => {
  if (!app.isPackaged) {
    try {
      await ensureDevelopmentServices();
    } catch (error) {
      console.error(error);
    }
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: isMac ? 'appMenu' : 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});

app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill();
  if (frontendProcess) frontendProcess.kill();
});
