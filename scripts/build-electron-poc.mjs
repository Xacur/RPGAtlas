/* Isolated Electron export proof of concept. Not connected to the editor UI. */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STANDALONE_EXPORT_FILES, PLAYER_BUNDLE_FILE } from "../js/build-manifest.mjs";
import { assembleStandaloneHtml, safeFileName } from "../js/standalone-template.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const projectPath = resolve(process.argv[2] || "Atlas_Quest.json");
const outDir = resolve(process.argv[3] || "electron-poc/out");
const project = JSON.parse(readFileSync(projectPath, "utf8"));
if (project?.meta?.engine !== "rpgatlas") throw new Error("Not an RPGAtlas project");
const title = project.system?.title || "RPGAtlas Game";
const base = safeFileName(title, "RPGAtlas_Game");
const bundle = join(root, "dist", PLAYER_BUNDLE_FILE);
// Always rebuild the player bundle for the POC: the Electron runtime must
// include the current shared engine, including fitStage() changes.
execFileSync(join(root, "node_modules/.bin/vite"), ["build"], { cwd: root, stdio: "inherit" });
const assets = [];
const embedded = new Set();
for (const a of project.assets?.external || []) { embedded.add(`asset:${a.type}/${a.name}`); assets.push(a); }
if (project.assets?.external) delete project.assets.external;
for (const key of new Set(JSON.stringify(project).match(/asset:[a-z]+\/[a-z0-9._-]+/g) || [])) {
  if (embedded.has(key)) continue;
  const [, type, name] = key.match(/^asset:([a-z]+)\/(.+)$/);
  const dir = join(root, "img", type);
  const hit = existsSync(dir) && readdirSync(dir).find((f) => f.replace(/\.[^.]+$/, "") === name);
  if (!hit) throw new Error("Unresolved asset: " + key);
  const ext = hit.split(".").pop().toLowerCase();
  const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", ogg: "audio/ogg", wav: "audio/wav", mp3: "audio/mpeg" }[ext] || "application/octet-stream";
  assets.push({ type, name, src: `data:${mime};base64,${readFileSync(join(dir, hit)).toString("base64")}` });
}
const files = STANDALONE_EXPORT_FILES.map((rel) => rel === PLAYER_BUNDLE_FILE ? readFileSync(bundle, "utf8") : readFileSync(join(root, rel), "utf8"));
const icon = `data:image/png;base64,${readFileSync(join(root, "img/system/icon_set.png")).toString("base64")}`;
const game = assembleStandaloneHtml(project, files, assets, icon);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "game.html"), game.html);
writeFileSync(join(outDir, "project.json"), JSON.stringify(project));
writeFileSync(join(outDir, "icon.png"), readFileSync(join(root, "img/system/icon_set.png")));
writeFileSync(join(outDir, "main.cjs"), readFileSync(join(root, "electron-poc/main.cjs")));
writeFileSync(join(outDir, "preload.cjs"), readFileSync(join(root, "electron-poc/preload.cjs")));
const iconPath = join(root, "img", "system", "rpgatlas.ico");
if (existsSync(iconPath)) writeFileSync(join(outDir, "icon.ico"), readFileSync(iconPath));
console.log(`[electron-poc] wrote ${join(outDir, "game.html")} (${game.html.length} bytes)`);
console.log(`[electron-poc] run with: npx electron ${join(outDir, "main.cjs")}`);
