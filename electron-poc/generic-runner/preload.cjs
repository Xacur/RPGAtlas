const { contextBridge } = require("electron");
contextBridge.exposeInMainWorld("RPGATLAS_NATIVE_HOST", { scaleToFit: true });
