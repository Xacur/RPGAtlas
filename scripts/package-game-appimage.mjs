/* RPGAtlas — Linux x86_64 native game AppImage packager.
   Reuses the native game HTML assembly and the editor's Linux AppImage wrapper.
   The game is embedded in a Tauri window; no browser or editor is required. */

import { execFileSync } from "node:child_process";
import {
  copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STANDALONE_EXPORT_FILES, PLAYER_BUNDLE_FILE } from "../js/build-manifest.mjs";
import { assembleStandaloneHtml, safeFileName } from "../js/standalone-template.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
const projectPath = args.find((arg) => !arg.startsWith("--"));
const outArg = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;
if (process.platform !== "linux" || process.arch !== "x64") {
  throw new Error("Linux game AppImage packaging must run on Linux x86_64.");
}
if (!projectPath) throw new Error("Usage: npm run package:game:appimage -- <project.json> [--out <AppImage>]");

const project = JSON.parse(readFileSync(resolve(projectPath), "utf8"));
if (!project?.meta || project.meta.engine !== "rpgatlas") throw new Error("Not an RPGAtlas project: " + projectPath);
const title = project.system?.title || "RPGAtlas Game";
const baseName = safeFileName(title, "RPGAtlas_Game");
const slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "game";
const gameDir = join(root, "src-tauri", "game-dist");
const overlayPath = join(root, "src-tauri", "game.conf.json");
const bundleDir = join(root, "src-tauri", "target", "release", "bundle", "appimage");
const appDir = join(bundleDir, baseName + ".AppDir");
const output = resolve(outArg || join(root, baseName + "-x86_64.AppImage"));
const run = (file, args, options = {}) => execFileSync(file, args, { cwd: root, stdio: "inherit", ...options });

function fileDataUrl(path) {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  const mime = { png: "image/png", webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", ogg: "audio/ogg", mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4" }[ext] || "application/octet-stream";
  return "data:" + mime + ";base64," + readFileSync(path).toString("base64");
}

// Assemble the same standalone payload used by HTML, Windows, and native game exports.
const usedAssets = [];
const embedded = new Set();
for (const item of project.assets?.external || []) {
  const key = "asset:" + item.type + "/" + item.name;
  embedded.add(key);
  usedAssets.push(item);
}
if (project.assets?.external) delete project.assets.external;
const referenced = new Set(JSON.stringify(project).match(/asset:[a-z]+\/[a-z0-9._-]+/g) || []);
const unresolved = [];
for (const key of referenced) {
  if (embedded.has(key)) continue;
  const [, type, name] = key.match(/^asset:([a-z]+)\/(.+)$/);
  const dir = join(root, "img", type);
  const hit = existsSync(dir) && readdirSync(dir).find((file) => file.replace(/\.[^.]+$/, "") === name);
  if (hit) usedAssets.push({ type, name, src: fileDataUrl(join(dir, hit)) });
  else unresolved.push(key);
}
if (unresolved.length) {
  throw new Error("Unresolved game assets:\n" + unresolved.map((key) => "  " + key).join("\n") + "\nRe-export the project with embedded assets or add the files to img/.");
}

const bundlePath = join(root, "dist", PLAYER_BUNDLE_FILE);
if (!existsSync(bundlePath)) run(join(root, "node_modules", ".bin", "vite"), ["build"]);
const files = STANDALONE_EXPORT_FILES.map((rel) => rel === PLAYER_BUNDLE_FILE ? readFileSync(bundlePath, "utf8") : readFileSync(join(root, rel), "utf8"));
const game = assembleStandaloneHtml(project, files, usedAssets, fileDataUrl(join(root, "img", "system", "icon_set.png")));
rmSync(gameDir, { recursive: true, force: true });
rmSync(overlayPath, { force: true });
rmSync(appDir, { recursive: true, force: true });
rmSync(output, { force: true });
mkdirSync(gameDir, { recursive: true });
writeFileSync(join(gameDir, "index.html"), game.html);
const width = Math.max(384, Math.floor(Number(project.system?.screenWidth) || 816));
const height = Math.max(288, Math.floor(Number(project.system?.screenHeight) || 624));
writeFileSync(overlayPath, JSON.stringify({
  productName: baseName,
  identifier: "com.rpgatlas.game." + slug.replace(/-/g, ""),
  build: { frontendDist: "game-dist", beforeBuildCommand: null, beforeDevCommand: null },
  app: { windows: [{ label: "main", title, width, height, minWidth: 384, minHeight: 288, resizable: true, useHttpsScheme: true }] },
  bundle: { active: true, targets: ["appimage"], icon: ["icons/icon.ico", "icons/icon.png"] },
}, null, 2));
console.log("[package-game-appimage] game assembled; invoking Tauri Linux AppImage build");
run(process.execPath, [join(root, "scripts", "build-linux-appimage.mjs")], {
  env: {
    ...process.env,
    RPGATLAS_APP_NAME: baseName,
    RPGATLAS_APPIMAGE_OUT: output,
    RPGATLAS_TAURI_CONFIG: overlayPath,
  },
});
const candidates = [
  output,
  join(root, baseName + "-x86_64.AppImage"),
  ...readdirSync(bundleDir).filter((name) => name.endsWith(".AppImage")).map((name) => join(bundleDir, name)),
].filter((path) => existsSync(path) && statSync(path).size > 0).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
if (!candidates.length) throw new Error("No game AppImage was produced in " + bundleDir + " or " + root);
if (candidates[0] !== output) copyFileSync(candidates[0], output);
console.log("[package-game-appimage] wrote " + output + " (" + statSync(output).size + " bytes)");
