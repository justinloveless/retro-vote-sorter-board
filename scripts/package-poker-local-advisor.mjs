#!/usr/bin/env node
/**
 * Zips tools/poker-local-advisor → public/poker-local-advisor.zip for download from the web app.
 */
import { createWriteStream, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const srcDir = join(root, 'tools', 'poker-local-advisor');
const publicDir = join(root, 'public');
const outZip = join(publicDir, 'poker-local-advisor.zip');

async function main() {
  mkdirSync(publicDir, { recursive: true });

  const output = createWriteStream(outZip);
  const archive = archiver('zip', { zlib: { level: 9 } });

  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') console.warn('[pack-advisor]', err);
      else reject(err);
    });
    archive.pipe(output);
    archive.directory(srcDir, 'poker-local-advisor');
    archive.finalize().catch(reject);
  });

  const { statSync } = await import('fs');
  const bytes = statSync(outZip).size;
  console.log(`[pack-advisor] wrote ${bytes} bytes → public/poker-local-advisor.zip`);
}

main().catch((e) => {
  console.warn('[pack-advisor] skipped:', e instanceof Error ? e.message : e);
  process.exit(0);
});
