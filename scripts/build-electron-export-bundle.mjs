/* Build and validate a local versioned Windows Electron export resource bundle. */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const version = process.env.RPGATLAS_EXPORT_BUNDLE_VERSION || "electron-44.8.0-nsis-3.0.4.1";
const out = resolve(process.env.RPGATLAS_EXPORT_BUNDLE_OUT || join(root, "electron-poc", "export-resources", version));
const runnerSource = join(root, "electron-poc", "generic-runner-dist", "win-unpacked");
const nsisSource = join(process.env.RPGATLAS_NSIS_CACHE || join(process.env.HOME || "", ".cache", "electron-builder"), "nsis-3.0.4.1", "nsis-3.0.4.1-1mx3n");
if (!existsSync(runnerSource)) throw new Error("Generic runner template missing: run scripts/prepare-electron-generic-runner.mjs first.");
if (!existsSync(nsisSource)) throw new Error("NSIS cache missing: " + nsisSource);
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "electron"), { recursive: true });
mkdirSync(join(out, "nsis"), { recursive: true });
execFileSync("cp", ["-a", runnerSource, join(out, "electron", "win-unpacked")]);
execFileSync("cp", ["-a", join(nsisSource, "linux"), join(out, "nsis")]);
execFileSync("cp", ["-a", join(nsisSource, "Bin"), join(out, "nsis")]);
execFileSync("cp", ["-a", join(nsisSource, "Include"), join(out, "nsis")]);
execFileSync("cp", ["-a", join(nsisSource, "Plugins"), join(out, "nsis")]);
execFileSync("cp", ["-a", join(nsisSource, "Stubs"), join(out, "nsis")]);
copyFileSync(join(nsisSource, "nsisconf.nsh"), join(out, "nsis", "nsisconf.nsh"));

function files(dir, prefix = "") {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = join(prefix, e.name); const p = join(dir, e.name);
    return e.isDirectory() ? files(p, rel) : [rel];
  });
}
function sha256(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
const manifest = { bundleVersion: version, runner: { electronVersion: "44.8.0", platform: "windows", arch: "x64", root: "electron/win-unpacked" }, nsis: { version: "3.0.4.1", hosts: ["linux-x64", "windows-x64"], root: "nsis" }, files: [] };
for (const rel of files(out)) { const p = join(out, rel); manifest.files.push({ path: rel.replaceAll("\\", "/"), bytes: statSync(p).size, sha256: sha256(p) }); }
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("[export-bundle] wrote " + out + " (" + manifest.files.length + " files)");
console.log("[export-bundle] validate with: node scripts/validate-electron-export-bundle.mjs " + out);
