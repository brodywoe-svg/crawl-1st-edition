const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("crawlApp", {
  load: () => ipcRenderer.invoke("crawl:load"),
  save: (text) => ipcRenderer.invoke("crawl:save", text),
  saveFile: (name, buf) => ipcRenderer.invoke("crawl:saveFile", name, buf),
  openJson: () => ipcRenderer.invoke("crawl:openJson"),
});
