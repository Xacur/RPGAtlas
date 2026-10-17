/* RPGAtlas — Linux AppImage build.
   Tauri's Arch linuxdeploy binary uses an older strip that cannot process
   RELR sections in current Arch libraries. Tauri still creates a complete
   AppDir before reporting that child failure; this wrapper reruns the same
   Tauri-downloaded tools with stripping disabled. The AppDir and output are
   removed first so recovery can never reuse stale build artifacts. */

import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const tauri = join(root, "node_modules", ".bin", "tauri");
const cache = join(process.env.XDG_CACHE_HOME || join(process.env.HOME || "", ".cache"), "tauri");
const bundleDir = join(root, "src-tauri", "target", "release", "bundle", "appimage");
const appName = process.env.RPGATLAS_APP_NAME || "RPGAtlas";
const appDir = join(bundleDir, appName + ".AppDir");
const output = resolve(process.env.RPGATLAS_APPIMAGE_OUT || join(root, appName + "-x86_64.AppImage"));
const bundledOutput = join(bundleDir, appName + "-x86_64.AppImage");
const generatedOutput = join(root, appName + "-x86_64.AppImage");
const configArg = process.env.RPGATLAS_TAURI_CONFIG ? ["--config", process.env.RPGATLAS_TAURI_CONFIG] : [];
const appBinary = join(appDir, "usr", "bin", "rpgatlas");
const linuxdeploy = join(cache, "linuxdeploy-x86_64.AppImage");
const appimagePlugin = join(cache, "linuxdeploy-plugin-appimage.AppImage");
const gstreamerPlugin = join(cache, "linuxdeploy-plugin-gstreamer.sh");

function run(file, args, options = {}) {
  execFileSync(file, args, { cwd: root, stdio: "inherit", ...options });
}

function completeAppDir() {
  return existsSync(appDir) && existsSync(appBinary) && statSync(appBinary).size > 0;
}

function publishOutput() {
  const candidates = [bundledOutput, generatedOutput,
    ...readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith("-x86_64.AppImage"))
      .map((entry) => join(root, entry.name)),
    ...readdirSync(bundleDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".AppImage"))
      .map((entry) => join(bundleDir, entry.name))];
  const candidate = candidates.find((file) => existsSync(file) && statSync(file).size > 0);
  if (!candidate) throw new Error("Tauri did not produce an AppImage in " + bundleDir);
  if (candidate !== output) copyFileSync(candidate, output);
  chmodSync(output, 0o755);
  if (!statSync(output).isFile() || statSync(output).size === 0) {
    throw new Error("AppImage output is empty: " + output);
  }
}

function runTauri() {
  try {
    execFileSync(tauri, ["build", "--bundles", "appimage", ...configArg], {
      cwd: root,
      stdio: ["inherit", "pipe", "pipe"],
    });
    process.stdout.write("[appimage] Tauri build completed\n");
    publishOutput();
    return false;
  } catch (error) {
    const text = Buffer.concat([error.stdout || Buffer.alloc(0), error.stderr || Buffer.alloc(0)]).toString();
    process.stdout.write(text);
    if (!completeAppDir() || !/failed to run linuxdeploy/i.test(text)) throw error;
    return true;
  }
}

if (process.platform !== "linux" || process.arch !== "x64") {
  throw new Error("Linux x86_64 AppImage packaging must run on Linux x86_64.");
}
if (!existsSync(tauri)) throw new Error("Tauri CLI is missing; run npm install first.");

// Only the requested AppImage is built, and every recovery input is fresh.
rmSync(appDir, { recursive: true, force: true });
rmSync(output, { force: true });
rmSync(bundledOutput, { force: true });
rmSync(generatedOutput, { force: true });
const recovered = runTauri();
if (!recovered) {
  console.log("[appimage] wrote " + output);
  process.exit(0);
}

if (!existsSync(linuxdeploy) || !existsSync(appimagePlugin)) {
  throw new Error("Tauri did not download its linuxdeploy tools into " + cache + ". Re-run with network access.");
}
if (!existsSync(gstreamerPlugin)) {
  throw new Error("Tauri did not download linuxdeploy-plugin-gstreamer.sh into " + cache + ". Re-run with network access.");
}

const gstDir = join(appDir, "usr", "lib", "gstreamer-1.0");
mkdirSync(gstDir, { recursive: true });
for (const name of ["libgstapp.so", "libgstautodetect.so", "libgstpulseaudio.so", "libgstpipewire.so", "libgstalsa.so", "libgstaudioconvert.so", "libgstaudioresample.so", "libgstcoreelements.so"]) {
  const source = join("/usr/lib/gstreamer-1.0", name);
  if (!existsSync(source)) throw new Error("Required host GStreamer plugin is missing: " + source);
  copyFileSync(source, join(gstDir, name));
}
copyFileSync("/usr/lib/gstreamer-1.0/gst-plugin-scanner", join(gstDir, "gst-plugin-scanner"));
copyFileSync("/usr/lib/gstreamer-1.0/gst-ptp-helper", join(gstDir, "gst-ptp-helper"));
run(linuxdeploy, ["--appdir", appDir, "--verbosity", "1"], {
  env: { ...process.env, NO_STRIP: "1" },
});
mkdirSync(join(appDir, "apprun-hooks"), { recursive: true });
writeFileSync(join(appDir, "apprun-hooks", "rpgatlas-gstreamer.sh"),
  "export GST_REGISTRY_REUSE_PLUGIN_SCANNER=no\n" +
  "export GST_PLUGIN_SYSTEM_PATH_1_0=\\\"${APPDIR}/usr/lib/gstreamer-1.0\\\"\n" +
  "export GST_PLUGIN_PATH_1_0=\\\"${APPDIR}/usr/lib/gstreamer-1.0\\\"\n" +
  "export GST_PLUGIN_SCANNER_1_0=\\\"${APPDIR}/usr/lib/gstreamer-1.0/gst-plugin-scanner\\\"\n");
run(appimagePlugin, ["--appdir", appDir], {
  env: { ...process.env, NO_STRIP: "1" },
});
publishOutput();
console.log("[appimage] wrote " + output);
