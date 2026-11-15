// Offline single-file build: bundles the React + TS game and compiles Tailwind
// into one self-contained HTML page (dist-standalone/index.html).
// Usage: node scripts/build-standalone.mjs [nodeModulesDir]
import { build } from 'esbuild';
import { compile } from 'tailwindcss';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeModules = process.argv[2] ?? path.join(root, 'node_modules');
const twDir = path.join(nodeModules, 'tailwindcss');

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

async function tailwindCss() {
  const src = await fs.readFile(path.join(root, 'src/index.css'), 'utf8');
  const compiler = await compile(src, {
    base: root,
    loadStylesheet: async (id, base) => {
      const file = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, id.startsWith('tailwindcss/') ? path.join(twDir, id.slice(12)) : id);
      return { path: file, base: path.dirname(file), content: await fs.readFile(file, 'utf8') };
    },
  });
  const candidates = new Set();
  for (const f of await walk(path.join(root, 'src'))) {
    const text = await fs.readFile(f, 'utf8');
    for (const m of text.matchAll(/[^\s"'`{}<>()=,;]+/g)) candidates.add(m[0]);
  }
  return compiler.build([...candidates]);
}

const css = await tailwindCss();
const result = await build({
  entryPoints: [path.join(root, 'src/main.tsx')],
  bundle: true,
  minify: process.env.MINIFY !== '0',
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
  write: false,
  outfile: path.join(root, 'dist-standalone/app.js'),
  nodePaths: [nodeModules],
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{
    name: 'skip-css',
    setup(b) {
      b.onResolve({ filter: /\.css$/ }, (a) => ({ path: a.path, namespace: 'skip' }));
      b.onLoad({ filter: /.*/, namespace: 'skip' }, () => ({ contents: '', loader: 'js' }));
    },
  }],
  logLevel: 'warning',
});
const js = result.outputFiles.find((f) => f.path.endsWith('.js')).text;
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Lost Signal</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap" rel="stylesheet" />
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js.replace(/<\/script/g, '<\\/script')}</script>
</body>
</html>`;
await fs.mkdir(path.join(root, 'dist-standalone'), { recursive: true });
await fs.writeFile(path.join(root, 'dist-standalone/index.html'), html);
const fragment = `<title>Lost Signal</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap" rel="stylesheet" />
<style>${css}</style>
<div id="root"></div>
<script>${js.replace(/<\/script/g, '<\\/script')}</script>
`;
await fs.writeFile(path.join(root, 'dist-standalone/artifact.html'), fragment);
console.log(`built dist-standalone/index.html (${(html.length / 1024).toFixed(0)} KB)`);
