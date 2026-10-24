// Schreibt Dateiliste und Cache-Version (Hash über alle Dateien) in sw.js.
// Aufruf im Projektordner:  node tools/update-sw.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const skip = new Set(['.git', 'tools', 'tests', 'sw.js', 'README.md', '.gitignore', '.nojekyll', '.claude', 'node_modules', 'docs', 'package.json']);

function walk(dir, rel = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (!rel && skip.has(e.name)) return [];
    const r = rel ? `${rel}/${e.name}` : e.name;
    return e.isDirectory() ? walk(path.join(dir, e.name), r) : [r];
  });
}
const files = walk(root).sort();
const hash = crypto.createHash('sha1');
for (const f of files) hash.update(f).update(fs.readFileSync(path.join(root, f)));
const version = hash.digest('hex').slice(0, 10);
const list = ['./', ...files.map((f) => './' + f)];
const block = `/* BEGIN GENERATED */\nconst CACHE = 'judo-${version}';\nconst FILES = ${JSON.stringify(list, null, 2)};\n/* END GENERATED */`;
const swPath = path.join(root, 'sw.js');
fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replace(/\/\* BEGIN GENERATED \*\/[\s\S]*?\/\* END GENERATED \*\//, block));
console.log(`sw.js aktualisiert: Version ${version}, ${list.length} Dateien`);
