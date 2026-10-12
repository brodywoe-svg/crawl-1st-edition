const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const dataFile = () => path.join(app.getPath("userData"), "spells.json");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 420,
    title: "Crawl Spell Compendium",
    backgroundColor: "#f4f4f4",
    icon: path.join(__dirname, process.platform === "win32" ? "crawl-logo.ico" : "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file://")) { e.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); }
  });
  win.loadFile(path.join(__dirname, "index.html"));
}

ipcMain.handle("crawl:load", async () => {
  try { return fs.readFileSync(dataFile(), "utf8"); } catch { return null; }
});

ipcMain.handle("crawl:save", async (_e, text) => {
  const file = dataFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) fs.copyFileSync(file, file + ".bak");
  fs.writeFileSync(file + ".tmp", text, "utf8");
  fs.renameSync(file + ".tmp", file);
  return true;
});

ipcMain.handle("crawl:saveFile", async (e, name, buf) => {
  const ext = path.extname(name).slice(1).toLowerCase();
  const labels = { png: "PNG image", jpg: "JPEG image", jpeg: "JPEG image", json: "Spell data" };
  const res = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), {
    defaultPath: path.join(app.getPath("documents"), name),
    filters: [{ name: labels[ext] || ext.toUpperCase(), extensions: [ext] }],
  });
  if (res.canceled || !res.filePath) return null;
  fs.writeFileSync(res.filePath, Buffer.from(buf));
  return path.basename(res.filePath);
});

ipcMain.handle("crawl:openJson", async (e) => {
  const res = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
    title: "Import spell data",
    filters: [{ name: "Spell data", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (res.canceled || !res.filePaths.length) return null;
  return fs.readFileSync(res.filePaths[0], "utf8");
});

Menu.setApplicationMenu(null);
app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
