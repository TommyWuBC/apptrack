/**
 * Build browser IIFE sdk.js and assert gzip size < 2KB.
 * Usage: pnpm --filter @apptrack/analytics-sdk build
 */
import * as esbuild from "esbuild";
import { gzipSync } from "node:zlib";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(root, "dist", "sdk.js");
const MAX_GZ = 2048;

mkdirSync(join(root, "dist"), { recursive: true });

await esbuild.build({
  entryPoints: [join(root, "src", "browser-entry.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2018"],
  outfile: outFile,
  legalComments: "none",
  logLevel: "silent",
});

const raw = readFileSync(outFile);
const gz = gzipSync(raw);
writeFileSync(join(root, "dist", "sdk.js.gz"), gz);

console.info(
  JSON.stringify({
    bytes: raw.length,
    gzip: gz.length,
    maxGzip: MAX_GZ,
    ok: gz.length < MAX_GZ,
  }),
);

if (gz.length >= MAX_GZ) {
  console.error(`sdk.js gzip ${gz.length} >= ${MAX_GZ}`);
  process.exit(1);
}
