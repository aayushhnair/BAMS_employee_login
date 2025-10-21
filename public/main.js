const { app, BrowserWindow, Menu, Tray, ipcMain, powerMonitor, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const Store = require('electron-store');
const path = require('path');
const isDev = require('electron-is-dev');

// Configure logging
log.transports.file.level = 'info';
log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
autoUpdater.logger = log;

// Initialize electron store
const store = new Store();

// Keep a global reference of the window object
let mainWindow;
let tray = null;
let isQuitting = false;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    titleBarStyle: 'default',
    autoHideMenuBar: true
  });

  // Load the app
  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle window close event (minimize to tray instead of closing)
  mainWindow.on('close', (event) => {
    if (!isQuitting && tray) {
      event.preventDefault();
      mainWindow.hide();
      
      // Notify renderer about window close for auto-logout
      mainWindow.webContents.send('window-close-triggered');
      
      return false;
    }
  });

  // Handle minimize event
  mainWindow.on('minimize', (event) => {
    if (tray && store.get('minimizeToTray', true)) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Handle window show/hide
  mainWindow.on('show', () => {
    if (tray) {
      tray.setHighlightMode('always');
    }
  });

  mainWindow.on('hide', () => {
    if (tray) {
      tray.setHighlightMode('never');
    }
  });
}

function createTray() {
  const trayIconPath = path.join(__dirname, '../assets/tray-icon.png');
  tray = new Tray(trayIconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show WorkSens',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Hide WorkSens',
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => {
        autoUpdater.checkForUpdatesAndNotify();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit WorkSens',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('WorkSens Employee Client');
  tray.setContextMenu(contextMenu);

  // Handle tray click
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // This method will be called when Electron has finished initialization
  app.whenReady().then(() => {
    createWindow();
    createTray();
    
    // Check for updates in production
    if (!isDev) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  });
}

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS it's common for applications to stay active until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  
  // Notify renderer about app quit for auto-logout
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app-before-quit');
  }
});

// Handle app suspension/resume (Windows sleep/wake)
if (powerMonitor) {
  powerMonitor.on('suspend', () => {
    log.info('System is going to sleep');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system-suspend');
    }
  });

  powerMonitor.on('resume', () => {
    log.info('System resumed from sleep');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system-resume');
    }
  });

  powerMonitor.on('lock-screen', () => {
    log.info('Screen locked');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('screen-locked');
    }
  });

  powerMonitor.on('unlock-screen', () => {
    log.info('Screen unlocked');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('screen-unlocked');
    }
  });
}

// IPC handlers
ipcMain.handle('get-device-info', async () => {
  const os = require('os');
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    version: os.release()
  };
});

ipcMain.handle('store-get', async (event, key, defaultValue) => {
  return store.get(key, defaultValue);
});

ipcMain.handle('store-set', async (event, key, value) => {
  store.set(key, value);
});

ipcMain.handle('store-delete', async (event, key) => {
  store.delete(key);
});

ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
});

ipcMain.handle('open-external', async (event, url) => {
  shell.openExternal(url);
});

ipcMain.handle('show-window', async () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.handle('hide-window', async () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

ipcMain.handle('minimize-window', async () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('quit-app', async () => {
  isQuitting = true;
  app.quit();
});

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  log.info('Update available.');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available.');
});

autoUpdater.on('error', (err) => {
  log.error('Error in auto-updater. ' + err);
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  log.info(log_message);
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-downloaded', info);
  }
});

// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (isDev) {
    // In development, ignore certificate errors
    event.preventDefault();
    callback(true);
  } else {
    // In production, use default behavior
    callback(false);
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

module.exports = { mainWindow };