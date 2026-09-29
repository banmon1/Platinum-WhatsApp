const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('platinumDesktop', Object.freeze({
  isDesktop: true,
  loadSession: () => ipcRenderer.invoke('session:load'),
  saveSession: (token) => ipcRenderer.invoke('session:save', token),
  clearSession: () => ipcRenderer.invoke('session:clear'),
  loadLanguage: () => ipcRenderer.invoke('language:load'),
  saveLanguage: (language) => ipcRenderer.invoke('language:save', language),
  openContact: () => ipcRenderer.invoke('contact:open'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  close: () => ipcRenderer.invoke('window:close'),
}));
