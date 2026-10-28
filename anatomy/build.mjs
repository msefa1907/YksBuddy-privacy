// Builds the two standalone pages:
//   index.html      — real-anatomy viewer (viewer/page.html + viewer/desc.js + viewer/app.js), loads data/*.bin.gz
//   prosedurel.html — procedural atlas (src/page.html + src/*.js), generates all geometry in the browser
// With --artifact <dir>, also writes variants without the document wrapper tags for publishing as claude.ai artifacts,
// plus a copy of data/ with the packs as base64 text.
import fs from 'fs';
import path from 'path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const read = (...p) => fs.readFileSync(path.join(dir, ...p), 'utf8');

function bundle(pageFile, jsFiles) {
  const js = jsFiles.map(f => `// ---- ${path.basename(f)} ----\n` + read(f)).join('\n');
  return read(pageFile).replace('/*__APP__*/', () => js);
}
const srcFiles = fs.readdirSync(path.join(dir, 'src')).filter(f => f.endsWith('.js')).sort().map(f => path.join('src', f));
const pages = {
  'index.html': bundle('viewer/page.html', ['viewer/desc.js', 'viewer/app.js']),
  'prosedurel.html': bundle('src/page.html', srcFiles),
};
for (const [name, html] of Object.entries(pages)) {
  fs.writeFileSync(path.join(dir, name), html);
  console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB`);
}
const ai = process.argv.indexOf('--artifact');
if (ai > 0) {
  const out = process.argv[ai + 1]; fs.mkdirSync(out, { recursive: true });
  for (const [name, html] of Object.entries(pages)) {
    const art = html
      .replace(/<!doctype html>\s*/i, '')
      .replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*/i, '')
      .replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '')
      .replace(/<body>\s*/i, '').replace(/<\/body>\s*/i, '')
      .replace(/<meta charset[^>]*>\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
    fs.writeFileSync(path.join(out, name), art);
  }
  // the artifact host serves only web media types, so packs go up as base64 text
  const dataOut = path.join(out, 'data'); fs.mkdirSync(dataOut, { recursive: true });
  const man = JSON.parse(read('data', 'manifest.json'));
  for (const L of Object.values(man.layers)) {
    const b64 = fs.readFileSync(path.join(dir, 'data', L.file)).toString('base64');
    L.file = L.file.replace(/\.bin\.gz$/, '.b64.txt'); L.size = b64.length;
    fs.writeFileSync(path.join(dataOut, L.file), b64);
  }
  fs.writeFileSync(path.join(dataOut, 'manifest.json'), JSON.stringify(man));
  console.log('artifact variants written to', out);
}
