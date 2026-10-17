const { app, BrowserWindow, Menu, session } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const project = JSON.parse(fs.readFileSync(path.join(__dirname, "project.json"), "utf8"));
const gameTitle = project.system?.title || "RPGAtlas Game";
const screenWidth = Math.max(384, Math.floor(Number(project.system?.screenWidth) || 816));
const screenHeight = Math.max(288, Math.floor(Number(project.system?.screenHeight) || 624));
const iconPath = path.join(__dirname, "icon.ico");
const electronWindowWidth = Math.max(384, Math.floor(Number(project.system?.screenWidth) || 816));
const electronWindowHeight = Math.max(288, Math.floor(Number(project.system?.screenHeight) || 624));

app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors");

function createWindow() {
  let windowedBounds = null;
  const win = new BrowserWindow({
    // Match Tauri's configured game viewport: Electron's width/height normally
    // include the native frame, while the game stage sizes to innerWidth/Height.
    useContentSize: true,
    width: electronWindowWidth,
    height: electronWindowHeight,
    minWidth: 384,
    minHeight: 288,
    title: gameTitle,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, "preload.cjs"),
      devTools: false,
    },
  });
  Menu.setApplicationMenu(null);
  win.webContents.on("before-input-event", (_event, input) => {
    if (input.type === "keyDown" && input.key === "F4") {
      if (win.isFullScreen()) {
        win.setFullScreen(false);
        if (windowedBounds) win.setBounds(windowedBounds);
      } else {
        windowedBounds = win.getBounds();
        win.setFullScreen(true);
      }
    }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) event.preventDefault();
  });
  void win.loadFile(path.join(__dirname, "game.html"));
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
