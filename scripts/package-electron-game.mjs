/* RPGAtlas — Electron native game export backend.
   Builds a project-specific Electron package without changing the editor UI.
   The generated application contains a prebuilt Electron runtime plus the
   assembled standalone game; players need neither RPGAtlas nor Node.js. */

import { build } from "electron-builder";
import { Arch, Platform } from "app-builder-lib";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STANDALONE_EXPORT_FILES, PLAYER_BUNDLE_FILE } from "../js/build-manifest.mjs";
import { assembleStandaloneHtml, safeFileName } from "../js/standalone-template.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
const projectPath = args.find((a) => !a.startsWith("--"));
const target = args.includes("--target") ? args[args.indexOf("--target") + 1] : null;
const outArg = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;
if (!projectPath || !["linux", "win"].includes(target)) {
  throw new Error("Usage: node scripts/package-electron-game.mjs <project.json> --target <linux|win> [--out <path>]");
}

const project = JSON.parse(readFileSync(resolve(projectPath), "utf8"));
if (project?.meta?.engine !== "rpgatlas") throw new Error("Not an RPGAtlas project: " + projectPath);
const title = project.system?.title || "RPGAtlas Game";
const baseName = safeFileName(title, "RPGAtlas_Game");
const slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "game";
const work = join(root, "electron-poc", "build", slug);
const outDir = join(root, "electron-poc", "dist");
const output = resolve(outArg || join(outDir, `${baseName}-Electron.${target === "linux" ? "AppImage" : "exe"}`));
const electronCli = join(root, "node_modules", ".bin", "vite");

function run(file, args) { execFileSync(file, args, { cwd: root, stdio: "inherit" }); }
function dataUrl(file) {
  const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
  const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", ogg: "audio/ogg", wav: "audio/wav", mp3: "audio/mpeg" }[ext] || "application/octet-stream";
  return `data:${mime};base64,${readFileSync(file).toString("base64")}`;
}

// Always refresh the player bundle so exported games contain current engine code.
run(electronCli, ["build"]);
const bundle = join(root, "dist", PLAYER_BUNDLE_FILE);
const assets = [];
const embedded = new Set();
for (const item of project.assets?.external || []) {
  embedded.add(`asset:${item.type}/${item.name}`);
  assets.push(item);
}
if (project.assets?.external) delete project.assets.external;
const unresolved = [];
for (const key of new Set(JSON.stringify(project).match(/asset:[a-z]+\/[a-z0-9._-]+/g) || [])) {
  if (embedded.has(key)) continue;
  const [, type, name] = key.match(/^asset:([a-z]+)\/(.+)$/);
  const dir = join(root, "img", type);
  const hit = existsSync(dir) && readdirSync(dir).find((f) => f.replace(/\.[^.]+$/, "") === name);
  if (hit) assets.push({ type, name, src: dataUrl(join(dir, hit)) });
  else unresolved.push(key);
}
if (unresolved.length) throw new Error("Unresolved assets:\n" + unresolved.join("\n"));

const files = STANDALONE_EXPORT_FILES.map((rel) => rel === PLAYER_BUNDLE_FILE ? readFileSync(bundle, "utf8") : readFileSync(join(root, rel), "utf8"));
const game = assembleStandaloneHtml(project, files, assets, dataUrl(join(root, "img/system/icon_set.png")));
rmSync(work, { recursive: true, force: true });
mkdirSync(join(work, "out"), { recursive: true });
copyFileSync(join(root, "electron-poc/main.cjs"), join(work, "main.cjs"));
copyFileSync(join(root, "electron-poc/preload.cjs"), join(work, "preload.cjs"));
writeFileSync(join(work, "game.html"), game.html);
writeFileSync(join(work, "package.json"), JSON.stringify({
  name: slug,
  productName: baseName,
  version: "1.0.0",
  desktopName: slug,
  main: "main.cjs",
}, null, 2));
writeFileSync(join(work, "project.json"), JSON.stringify(project));
const ico = join(root, "img/system/rpgatlas.ico");
const iconPng = join(root, "src-tauri/icons/icon.png");
if (existsSync(ico)) copyFileSync(ico, join(work, "icon.ico"));
if (target === "linux" && !existsSync(iconPng)) throw new Error("Linux Electron packaging requires src-tauri/icons/icon.png");
if (target === "linux") copyFileSync(iconPng, join(work, "icon.png"));
const width = Math.max(384, Math.floor(Number(project.system?.screenWidth) || 816));
const height = Math.max(288, Math.floor(Number(project.system?.screenHeight) || 624));
const config = {
  appId: `com.rpgatlas.game.${slug.replace(/-/g, "")}`,
  productName: baseName,
  directories: { app: work, output: outDir },
  files: ["**/*"],
  extraMetadata: { name: slug, productName: baseName, version: "1.0.0", main: "main.cjs" },
  extraResources: [],
  linux: {
    target: ["AppImage"],
    category: "Game",
    executableName: slug,
    icon: join(work, "icon.png"),
    syncDesktopName: true,
    artifactName: `${baseName}-Electron.AppImage`,
  },
  win: {
    target: ["portable"],
    icon: join(work, "icon.ico"),
    artifactName: `${baseName}-Electron.exe`,
  },
  buildVersion: "1.0.0",
  electronVersion: "44.8.0",
};
const requestedPlatform = target === "linux" ? Platform.LINUX : Platform.WINDOWS;
const targets = requestedPlatform.createTarget(target === "linux" ? ["AppImage"] : ["portable"], Arch.x64);
const result = await build({
  config,
  projectDir: work,
  targets,
});
const candidates = (result || []).filter((p) => p.endsWith(target === "linux" ? ".AppImage" : ".exe"));
if (!candidates.length || !existsSync(candidates[0]) || statSync(candidates[0]).size === 0) throw new Error("Electron produced no output for " + target);
if (resolve(candidates[0]) !== output) copyFileSync(candidates[0], output);
console.log(`[electron] wrote ${output} (${statSync(output).size} bytes)`);
