const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('platinumDesktop', Object.freeze({
  isDesktop: true,
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  close: () => ipcRenderer.invoke('window:close'),
}));
