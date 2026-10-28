// Concatenates src/*.js (in name order) into one inline module inside src/page.html.
// Output: index.html (standalone page). With --artifact <out>, also writes a variant
// without the document wrapper tags for publishing as a claude.ai artifact.
import fs from 'fs';
import path from 'path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const srcDir = path.join(dir, 'src');
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js')).sort();
const js = files.map(f => `// ---- ${f} ----\n` + fs.readFileSync(path.join(srcDir, f), 'utf8')).join('\n');
const page = fs.readFileSync(path.join(srcDir, 'page.html'), 'utf8');
const out = page.replace('/*__APP__*/', () => js);
fs.writeFileSync(path.join(dir, 'index.html'), out);
console.log(`index.html: ${(out.length / 1024).toFixed(0)} KB from ${files.length} modules`);
const ai = process.argv.indexOf('--artifact');
if (ai > 0) {
  const art = out
    .replace(/<!doctype html>\s*/i, '')
    .replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*/i, '')
    .replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '')
    .replace(/<body>\s*/i, '').replace(/<\/body>\s*/i, '')
    .replace(/<meta charset[^>]*>\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
  fs.writeFileSync(process.argv[ai + 1], art);
  console.log('artifact written');
}
