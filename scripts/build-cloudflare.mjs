import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile, copyFile, rm, stat} from 'node:fs/promises';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');
// This fixed build-output folder is the only directory this script removes.
await rm(output, {recursive: true, force: true});
await mkdir(output, {recursive: true});
const files = execFileSync('git', ['ls-files', '-z'], {cwd: root, encoding: 'utf8'}).split('\0').filter(Boolean);
let count = 0;
for (const name of files) {
  if (/^(?:website|assets|vendor)\//.test(name) || (!name.includes('/') && /\.(?:html|css|js|mjs|svg|png|webp|jpg|jpeg|ico|json|webmanifest)$/.test(name))) {
    const source = join(root, name), destination = join(output, name);
    if ((await stat(source)).size > 25 * 1024 * 1024) throw Error(`Asset exceeds Pages limit: ${name}`);
    await mkdir(dirname(destination), {recursive: true});
    if (name === 'website/index.html') {
      const html = await readFile(source, 'utf8');
      await writeFile(destination, html.replaceAll('"./', '"/website/'));
    } else await copyFile(source, destination);
    count++;
  }
}
await copyFile(join(root, 'deploy/cloudflare-worker.mjs'), join(output, '_worker.js'));
// Disable the default SPA fallback: missing assets must be real 404 responses.
await writeFile(join(output, '404.html'), '<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>چیدو | صفحه پیدا نشد</title><h1>صفحه پیدا نشد</h1><a href="https://chidoset.ir/">بازگشت به چیدو</a></html>');
console.log(`Cloudflare Pages build complete: ${count} public files. No database, QA, or source administration files included.`);
