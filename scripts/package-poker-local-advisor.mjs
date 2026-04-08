#!/usr/bin/env node
/**
 * Zips tools/poker-local-advisor → public/poker-local-advisor.zip (stable) and
 * public/poker-local-advisor-nightly.zip (nightly), and writes
 * public/poker-local-advisor-manifest.json for the local advisor self-update feature.
 */
import { createWriteStream, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { cp, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const srcDir = join(root, 'tools', 'poker-local-advisor');
const publicDir = join(root, 'public');
const outZipStable = join(publicDir, 'poker-local-advisor.zip');
const outZipNightly = join(publicDir, 'poker-local-advisor-nightly.zip');
const outManifest = join(publicDir, 'poker-local-advisor-manifest.json');

function readAdvisorVersion() {
  const raw = readFileSync(join(srcDir, 'version.json'), 'utf8');
  const j = JSON.parse(raw);
  if (typeof j.version !== 'string' || !j.version.trim()) {
    throw new Error('version.json must include a non-empty "version" string');
  }
  return { version: j.version.trim(), channel: typeof j.channel === 'string' ? j.channel : 'stable' };
}

function buildNightlyVersion(stableVersion) {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const sha = (process.env.GITHUB_SHA || process.env.SOURCE_VERSION || '').trim().slice(0, 7);
  const tail = sha || 'local';
  return `${stableVersion}-nightly.${y}${m}${day}.${tail}`;
}

/**
 * @param {string} outPath
 * @param {string} sourceDir - directory whose files become poker-local-advisor/ in the zip
 */
async function writeZip(outPath, sourceDir) {
  const output = createWriteStream(outPath);
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
    archive.directory(sourceDir, 'poker-local-advisor');
    archive.finalize().catch(reject);
  });
}

async function main() {
  mkdirSync(publicDir, { recursive: true });

  const { version: stableVersion } = readAdvisorVersion();
  const nightlyVersion = buildNightlyVersion(stableVersion);

  const manifest = {
    stable: {
      version: stableVersion,
      zipPath: '/poker-local-advisor.zip',
      channel: 'stable',
    },
    nightly: {
      version: nightlyVersion,
      zipPath: '/poker-local-advisor-nightly.zip',
      channel: 'nightly',
    },
  };

  writeFileSync(outManifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`[pack-advisor] wrote manifest → public/poker-local-advisor-manifest.json`);

  await writeZip(outZipStable, srcDir);
  console.log(
    `[pack-advisor] wrote ${statSync(outZipStable).size} bytes → public/poker-local-advisor.zip`,
  );

  const tmp = await mkdtemp(join(tmpdir(), 'poker-local-advisor-pack-'));
  try {
    const staging = join(tmp, 'stage');
    await cp(srcDir, staging, { recursive: true });
    writeFileSync(
      join(staging, 'version.json'),
      `${JSON.stringify({ version: nightlyVersion, channel: 'nightly' }, null, 2)}\n`,
      'utf8',
    );
    await writeZip(outZipNightly, staging);
    console.log(
      `[pack-advisor] wrote ${statSync(outZipNightly).size} bytes → public/poker-local-advisor-nightly.zip`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.warn('[pack-advisor] skipped:', e instanceof Error ? e.message : e);
  process.exit(0);
});
