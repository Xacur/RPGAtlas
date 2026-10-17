const { contextBridge } = require("electron");

// Expose only the opt-in scaling flag; no Node or IPC API is exposed to the game.
contextBridge.exposeInMainWorld("RPGATLAS_NATIVE_HOST", {
  scaleToFit: true,
});
