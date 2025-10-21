const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Device and system info
  getDeviceInfo: () => ipcRenderer.invoke('get-device-info'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Store operations
  storeGet: (key, defaultValue) => ipcRenderer.invoke('store-get', key, defaultValue),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
  storeDelete: (key) => ipcRenderer.invoke('store-delete', key),
  
  // Window controls
  showWindow: () => ipcRenderer.invoke('show-window'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  
  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Event listeners
  onWindowCloseTriggered: (callback) => {
    ipcRenderer.on('window-close-triggered', callback);
  },
  
  onAppBeforeQuit: (callback) => {
    ipcRenderer.on('app-before-quit', callback);
  },
  
  onSystemSuspend: (callback) => {
    ipcRenderer.on('system-suspend', callback);
  },
  
  onSystemResume: (callback) => {
    ipcRenderer.on('system-resume', callback);
  },
  
  onScreenLocked: (callback) => {
    ipcRenderer.on('screen-locked', callback);
  },
  
  onScreenUnlocked: (callback) => {
    ipcRenderer.on('screen-unlocked', callback);
  },
  
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', callback);
  },
  
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', callback);
  },
  
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', callback);
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // Platform info
  platform: process.platform,
  
  // Node.js globals that are safe to expose
  process: {
    platform: process.platform,
    arch: process.arch,
    versions: process.versions
  }
});

// Expose a limited Node.js API for specific functionality
contextBridge.exposeInMainWorld('nodeAPI', {
  os: {
    hostname: () => require('os').hostname(),
    platform: () => require('os').platform(),
    arch: () => require('os').arch(),
    release: () => require('os').release(),
    type: () => require('os').type()
  },
  
  path: {
    join: (...args) => require('path').join(...args),
    resolve: (...args) => require('path').resolve(...args),
    dirname: (path) => require('path').dirname(path),
    basename: (path, ext) => require('path').basename(path, ext)
  },
  
  crypto: {
    randomUUID: () => require('crypto').randomUUID()
  }
});

// Log that preload script has loaded
console.log('WorkSens Employee Client preload script loaded');