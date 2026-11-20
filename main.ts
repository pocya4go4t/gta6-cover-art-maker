// Sunset Cover Studio — the gta6-cover-art-01 entry (Node 22, standard library
// only). The app is this directory's app/ folder: plain static files a desktop
// browser loads offline (app/index.html and its ES modules, the Anton and Oswald
// fonts under app/fonts/, four sample photos under app/samples/ — no library and
// no network request). The program first verifies the entry against the
// scorer's own caps, then hands it in: it copies app/ and screenshots/ from
// beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import {
  cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync,
} from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const APP_MAX_FILES = 993;
const APP_MAX_BYTES = 50331648; // 48 MiB
const APP_PATH_MAX_BYTES = 1000;
const SHOT_MAX = 4;
const SHOT_MAX_BYTES = 262144; // 256 KiB
const SHOT_LONG_MAX = 1280;
const SHOT_SHORT_MIN = 480;
const INDEX_MAX_BYTES = 1048576; // 1 MiB

const failures: string[] = [];
function check(ok: boolean, detail: string): void {
  if (!ok) failures.push(detail);
}

/** Every file under a directory, as paths relative to it. */
function walk(dir: string, rel = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(join(dir, rel), { withFileTypes: true })) {
    const p = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...walk(dir, p));
    else if (entry.isFile()) found.push(p);
  }
  return found;
}

/** Image dimensions from a PNG IHDR or a JPEG SOF marker, or null if unreadable. */
function imageSize(file: string): { w: number; h: number } | null {
  const buf = readFileSync(file);
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      const len = buf.readUInt16BE(i + 2);
      i += 2 + len;
    }
  }
  return null;
}

// ---- verification pass over the entry, before anything is handed in ----

// 1. The app's front door exists and fits the scorer's cap.
const indexPath = join(here, 'app', 'index.html');
check(existsSync(indexPath), 'app/index.html is missing');
if (existsSync(indexPath)) {
  check(statSync(indexPath).size <= INDEX_MAX_BYTES, `app/index.html is over ${INDEX_MAX_BYTES} bytes`);
}

// 2. The app's file tree fits the scorer's caps, and no path is too long.
const appFiles = walk(join(here, 'app'));
check(appFiles.length <= APP_MAX_FILES, `app/ holds ${appFiles.length} files, over the ${APP_MAX_FILES} cap`);
let appBytes = 0;
for (const rel of appFiles) {
  const full = join(here, 'app', rel);
  appBytes += statSync(full).size;
  check(Buffer.byteLength(rel, 'utf8') <= APP_PATH_MAX_BYTES, `app/${rel} is over ${APP_PATH_MAX_BYTES} bytes as a path`);
}
check(appBytes <= APP_MAX_BYTES, `app/ is ${appBytes} bytes, over the ${APP_MAX_BYTES} cap`);

// 3. Every reference index.html makes stays inside app/ and names a real file:
//    no http(s) URL, no protocol-relative URL, no path climbing out of app/.
if (existsSync(indexPath)) {
  const html = readFileSync(indexPath, 'utf8');
  const refs = [...html.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
  check(refs.length > 0, 'app/index.html names no src or href at all');
  for (const ref of refs) {
    if (ref.startsWith('data:') || ref.startsWith('#')) continue;
    check(!/^(?:https?:)?\/\//.test(ref), `app/index.html loads over the network: ${ref}`);
    const target = resolve(join(here, 'app'), ref.replace(/^\//, ''));
    check(target === join(here, 'app') || target.startsWith(join(here, 'app') + sep), `app/index.html references a path outside app/: ${ref}`);
    check(existsSync(target), `app/index.html references a missing file: ${ref}`);
  }
}

// 4. The shipped fonts are present (the app's lettering depends on them).
for (const font of ['app/fonts/Anton-Regular.ttf', 'app/fonts/Oswald.ttf', 'app/fonts/OFL.txt']) {
  check(existsSync(join(here, font)), `${font} is missing`);
}

// 5. Screenshots: 3 or 4, each a whole PNG or JPEG inside the size limits.
const shotsDir = join(here, 'screenshots');
check(existsSync(shotsDir), 'screenshots/ is missing');
const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((f) => !f.startsWith('.')) : [];
check(shots.length >= 3 && shots.length <= SHOT_MAX, `screenshots/ holds ${shots.length} images, need 3 to ${SHOT_MAX}`);
for (const name of shots) {
  check(/^[A-Za-z0-9._-]+$/.test(name) && !name.startsWith('.') && !name.startsWith('-'), `screenshot name is not allowed: ${name}`);
  const full = join(shotsDir, name);
  check(statSync(full).size <= SHOT_MAX_BYTES, `screenshots/${name} is over ${SHOT_MAX_BYTES} bytes`);
  const dims = imageSize(full);
  check(dims !== null, `screenshots/${name} is not a readable PNG or JPEG`);
  if (dims) {
    const long = Math.max(dims.w, dims.h);
    const short = Math.min(dims.w, dims.h);
    check(long <= SHOT_LONG_MAX, `screenshots/${name} is ${dims.w}x${dims.h}, long side over ${SHOT_LONG_MAX}`);
    check(short >= SHOT_SHORT_MIN, `screenshots/${name} is ${dims.w}x${dims.h}, short side under ${SHOT_SHORT_MIN}`);
  }
}

if (failures.length > 0) {
  console.error(`verification failed (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`verification passed: ${appFiles.length} app files (${appBytes} bytes), ${shots.length} screenshots`);

// ---- hand the entry in ----
mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
