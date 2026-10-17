import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
const root = resolve(process.argv[2] || "electron-poc/export-resources/electron-44.8.0-nsis-3.0.4.1");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
for (const item of manifest.files) {
  const p = join(root, item.path); const data = readFileSync(p);
  const hash = createHash("sha256").update(data).digest("hex");
  if (data.length !== item.bytes || hash !== item.sha256) throw new Error("Checksum mismatch: " + item.path);
}
console.log("[export-bundle] valid: " + manifest.bundleVersion + " (" + manifest.files.length + " files)");
