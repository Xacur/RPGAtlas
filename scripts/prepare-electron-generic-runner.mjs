/* Prepare a payload-independent Electron runner template during development. */
import { build } from "electron-builder";
import { Arch, Platform } from "app-builder-lib";
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const appDir = join(root, "electron-poc", "generic-runner-app");
const outDir = join(root, "electron-poc", "generic-runner-dist");
rmSync(appDir, { recursive: true, force: true }); mkdirSync(appDir, { recursive: true });
copyFileSync(join(root, "electron-poc/generic-runner/main.cjs"), join(appDir, "main.cjs"));
copyFileSync(join(root, "electron-poc/generic-runner/preload.cjs"), join(appDir, "preload.cjs"));
writeFileSync(join(appDir, "package.json"), JSON.stringify({ name: "rpgatlas-electron-generic-runner", productName: "RPGAtlas Generic Runner", version: "1.0.0", main: "main.cjs" }, null, 2));
await build({
  config: { appId: "com.rpgatlas.generic.runner", productName: "RPGAtlas Generic Runner", directories: { app: appDir, output: outDir }, files: ["**/*"], linux: { target: ["dir"] }, win: { target: ["dir"] }, electronVersion: "44.8.0" },
  projectDir: appDir,
  targets: Platform.WINDOWS.createTarget(["dir"], Arch.x64),
});
console.log("[generic-runner] prepared Electron template in " + outDir);
