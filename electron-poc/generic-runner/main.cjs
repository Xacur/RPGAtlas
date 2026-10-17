const { app, BrowserWindow, Menu, session } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const payloadDir = path.join(process.resourcesPath, "game");
const project = JSON.parse(fs.readFileSync(path.join(payloadDir, "project.json"), "utf8"));
const gameId = String(project.meta?.gameId || project.system?.gameId || project.system?.title || "rpgatlas-game")
  .toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "rpgatlas-game";
app.setPath("userData", path.join(app.getPath("appData"), "RPGAtlas", gameId));
const title = project.system?.title || "RPGAtlas Game";
const width = Math.max(384, Math.floor(Number(project.system?.screenWidth) || 816));
const height = Math.max(288, Math.floor(Number(project.system?.screenHeight) || 624));

function createWindow() {
  let windowedBounds = null;
  const win = new BrowserWindow({
    useContentSize: true, width, height, minWidth: 384, minHeight: 288,
    title, icon: fs.existsSync(path.join(payloadDir, "icon.ico")) ? path.join(payloadDir, "icon.ico") : undefined,
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, preload: path.join(__dirname, "preload.cjs"), devTools: false },
  });
  Menu.setApplicationMenu(null);
  win.webContents.on("before-input-event", (_e, input) => {
    if (input.type === "keyDown" && input.key === "F4") {
      if (win.isFullScreen()) { win.setFullScreen(false); if (windowedBounds) win.setBounds(windowedBounds); }
      else { windowedBounds = win.getBounds(); win.setFullScreen(true); }
    }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("file://")) e.preventDefault(); });
  void win.loadFile(path.join(payloadDir, "game.html"));
}
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_w, _p, cb) => cb(false));
  createWindow();
  app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
