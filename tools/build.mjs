import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent, imagePaths } from '../admin/content.mjs';
import { renderWebsite } from '../admin/site-renderer.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--out-dir')) throw new Error('Usage: node tools/build.mjs [--out-dir dist]');
const output = args.length ? path.resolve(root, args[1]) : root;
const relativeOutput = path.relative(root, output);
if (args.length && (!relativeOutput || relativeOutput.startsWith('..') || path.isAbsolute(relativeOutput) || /^(assets|admin|data|tools|\.git|\.qa)([\\/]|$)/.test(relativeOutput))) throw new Error('Choose a separate output folder inside the workspace, such as dist.');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/site.json'), 'utf8').replace(/^\uFEFF/, ''));
const contentErrors = validateContent(data);
if (contentErrors.length) throw new Error(contentErrors.join('\n'));
// Render and verify every referenced image before writing any public page.
const rendered = Object.entries(renderWebsite(data));
for (const image of new Set(imagePaths(data))) {
  if (!fs.existsSync(path.join(root, image)) || !fs.statSync(path.join(root, image)).isFile()) throw new Error(`Image not found: ${image}`);
}
fs.mkdirSync(output, { recursive: true });
for (const [file, html] of rendered) fs.writeFileSync(path.join(output, file), html, 'utf8');
if (output !== root) {
  for (const directory of ['assets', 'admin']) fs.cpSync(path.join(root, directory), path.join(output, directory), { recursive: true });
  fs.mkdirSync(path.join(output, 'data'), { recursive: true });
  fs.copyFileSync(path.join(root, 'data/site.json'), path.join(output, 'data/site.json'));
  fs.copyFileSync(path.join(root, '.nojekyll'), path.join(output, '.nojekyll'));
}
console.log(`Updated ${rendered.length} pages${output !== root ? ' in ' + relativeOutput : ''}. Run npm start to preview the website and editor.`);
