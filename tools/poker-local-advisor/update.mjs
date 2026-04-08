/**
 * Self-update: fetch manifest + zip from an allowlisted origin only (env or request Origin header).
 */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { cp, mkdir, mkdtemp, open, readFile, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

export const MANIFEST_PATH = '/poker-local-advisor-manifest.json';

/** Used when `POKER_ADVISOR_UPDATE_ORIGIN` is unset and no `Origin` / `X-Retroscope-App-Origin` header is present. */
export const DEFAULT_POKER_ADVISOR_UPDATE_ORIGIN = 'https://retro-scope.lovable.app';

const LOCK_NAME = '.poker-local-advisor-update.lock';

/** @typedef {{ version: string, channel: string }} AdvisorVersionInfo */

/** @typedef {{ version: string, zipPath: string, channel: string }} ManifestChannel */

/** @typedef {{ stable: ManifestChannel, nightly: ManifestChannel }} AdvisorManifest */

/**
 * @param {string} installDir
 * @returns {Promise<AdvisorVersionInfo>}
 */
export async function readLocalAdvisorVersion(installDir) {
  const raw = await readFile(join(installDir, 'version.json'), 'utf8');
  const j = JSON.parse(raw);
  const version = typeof j.version === 'string' ? j.version.trim() : '';
  const channel = typeof j.channel === 'string' ? j.channel.trim() : 'stable';
  if (!version) throw new Error('Local version.json has no version string');
  return { version, channel };
}

/**
 * @param {Record<string, string | string[] | undefined>} headers
 */
function headerFirst(headers, name) {
  const v = headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0] ?? '';
  return typeof v === 'string' ? v : '';
}

/**
 * @param {string | undefined} envOrigin POKER_ADVISOR_UPDATE_ORIGIN
 * @param {Record<string, string | string[] | undefined>} headers
 * @returns {string | null} origin without trailing slash; null only if env is set but not a valid http(s) URL
 */
export function resolveUpdateOrigin(envOrigin, headers) {
  const fromEnv = (envOrigin || '').trim();
  if (fromEnv) {
    try {
      const u = new URL(fromEnv);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u.origin;
    } catch {
      return null;
    }
  }
  const fromHdr =
    headerFirst(headers, 'x-retroscope-app-origin') || headerFirst(headers, 'origin');
  const raw = fromHdr.trim();
  if (raw) {
    try {
      const u = new URL(raw);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        return new URL(DEFAULT_POKER_ADVISOR_UPDATE_ORIGIN).origin;
      }
      return u.origin;
    } catch {
      /* ignore bad header, use default */
    }
  }
  return new URL(DEFAULT_POKER_ADVISOR_UPDATE_ORIGIN).origin;
}

/**
 * @param {string} origin
 * @returns {Promise<AdvisorManifest>}
 */
export async function fetchRemoteManifest(origin) {
  const url = new URL(MANIFEST_PATH, `${origin}/`);
  const res = await fetch(url.href, {
    redirect: 'follow',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Manifest HTTP ${res.status} for ${url.href}`);
  }
  const j = await res.json();
  if (!j || typeof j !== 'object') throw new Error('Manifest is not a JSON object');
  const stable = j.stable;
  const nightly = j.nightly;
  if (!stable?.version || !stable?.zipPath || !nightly?.version || !nightly?.zipPath) {
    throw new Error('Manifest missing stable/nightly version or zipPath');
  }
  return /** @type {AdvisorManifest} */ (j);
}

/**
 * @param {string} s
 * @returns {{ major: number, minor: number, patch: number, prerelease: string } | null}
 */
function parseSemver(s) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(s.trim());
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] || '',
  };
}

/**
 * @param {{ major: number, minor: number, patch: number, prerelease: string }} a
 * @param {{ major: number, minor: number, patch: number, prerelease: string }} b
 */
function cmpSemverParts(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (!a.prerelease && b.prerelease) return 1;
  if (a.prerelease && !b.prerelease) return -1;
  if (a.prerelease === b.prerelease) return 0;
  return a.prerelease < b.prerelease ? -1 : a.prerelease > b.prerelease ? 1 : 0;
}

/**
 * True if remote should be installed over local (not equal, remote is newer).
 * For `nightly`, same major.minor.patch with a different build id (e.g. stable 1.0.0 → nightly 1.0.0-nightly.…) counts as an update.
 * @param {string} localVersion
 * @param {string} remoteVersion
 * @param {'stable' | 'nightly'} channel
 */
export function isRemoteNewer(localVersion, remoteVersion, channel = 'stable') {
  if (localVersion === remoteVersion) return false;
  const l = parseSemver(localVersion);
  const r = parseSemver(remoteVersion);
  if (channel === 'nightly' && l && r) {
    const baseCmp =
      r.major - l.major || r.minor - l.minor || r.patch - l.patch;
    if (baseCmp > 0) return true;
    if (baseCmp < 0) return false;
    return remoteVersion !== localVersion;
  }
  if (l && r) {
    const c = cmpSemverParts(r, l);
    if (c > 0) return true;
    if (c < 0) return false;
  }
  return remoteVersion > localVersion;
}

/**
 * @param {AdvisorManifest} manifest
 * @param {string} channel
 * @returns {ManifestChannel}
 */
export function getManifestChannel(manifest, channel) {
  const c = (channel || 'stable').toLowerCase();
  if (c === 'nightly') return manifest.nightly;
  return manifest.stable;
}

/**
 * @param {string} installDir
 * @returns {Promise<() => Promise<void>>}
 */
export async function acquireUpdateLock(installDir) {
  const lockPath = join(installDir, LOCK_NAME);
  let handle;
  try {
    handle = await open(lockPath, 'wx');
  } catch (e) {
    const err = /** @type {NodeJS.ErrnoException} */ (e);
    if (err.code === 'EEXIST') {
      throw new Error('Another update is already in progress');
    }
    throw e;
  }
  await handle.writeFile(`${process.pid}\n`, 'utf8');
  return async () => {
    try {
      await handle.close();
    } catch {
      /* ignore */
    }
    try {
      await unlink(lockPath);
    } catch {
      /* ignore */
    }
  };
}

/**
 * @param {string} zipPath
 * @param {string} destDir
 */
function extractZipWithTar(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    const child = spawn('tar', ['-xf', zipPath, '-C', destDir], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let err = '';
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (c) => {
      err += c;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.trim() || `tar exited ${code}`));
    });
  });
}

/**
 * @param {string} zipPath
 * @param {string} destDir
 */
function extractZipWithUnzip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    const child = spawn('unzip', ['-o', '-q', zipPath, '-d', destDir], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let err = '';
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (c) => {
      err += c;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.trim() || `unzip exited ${code}`));
    });
  });
}

/**
 * @param {string} zipPath
 * @param {string} destDir
 */
export async function extractZipArchive(zipPath, destDir) {
  try {
    await extractZipWithTar(zipPath, destDir);
  } catch (tarErr) {
    try {
      await extractZipWithUnzip(zipPath, destDir);
    } catch {
      throw tarErr;
    }
  }
}

/**
 * @param {string} url
 * @param {string} destFile
 */
async function downloadToFile(url, destFile) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download HTTP ${res.status} for ${url}`);
  if (!res.body) throw new Error('Download has no body');
  const out = createWriteStream(destFile);
  await pipeline(
    /** @type {import('node:stream').Readable} */ (res.body),
    out,
  );
}

/**
 * @param {string} origin
 * @param {string} zipPath must start with /
 */
function zipUrl(origin, zipPath) {
  const path = zipPath.startsWith('/') ? zipPath : `/${zipPath}`;
  if (path.includes('..') || path.includes('//')) {
    throw new Error('Invalid zipPath in manifest');
  }
  if (!/^\/[\w./-]+$/.test(path)) {
    throw new Error('Invalid zipPath in manifest');
  }
  const u = new URL(path, `${origin}/`);
  const base = new URL(`${origin}/`);
  if (u.origin !== base.origin) {
    throw new Error('Zip URL must use the same origin as the update server');
  }
  return u.href;
}

/**
 * @param {object} options
 * @param {string} options.installDir
 * @param {'stable' | 'nightly'} options.channel
 * @param {Record<string, string | string[] | undefined>} options.headers
 * @param {string | undefined} options.envUpdateOrigin
 */
export async function runUpdateCheck({ installDir, channel, headers, envUpdateOrigin }) {
  const origin = resolveUpdateOrigin(envUpdateOrigin, headers);
  if (!origin) {
    const err = new Error(
      'POKER_ADVISOR_UPDATE_ORIGIN is set but is not a valid http(s) URL. Unset it to use the default host or fix the value.',
    );
    err.code = 'NO_ORIGIN';
    throw err;
  }
  const local = await readLocalAdvisorVersion(installDir);
  const manifest = await fetchRemoteManifest(origin);
  const entry = getManifestChannel(manifest, channel);
  const updateAvailable = isRemoteNewer(local.version, entry.version, channel);
  return {
    currentVersion: local.version,
    currentChannel: local.channel,
    remoteVersion: entry.version,
    remoteChannel: entry.channel,
    updateAvailable,
    updateOrigin: origin,
  };
}

/**
 * @param {object} options
 * @param {string} options.installDir
 * @param {'stable' | 'nightly'} options.channel
 * @param {Record<string, string | string[] | undefined>} options.headers
 * @param {string | undefined} options.envUpdateOrigin
 */
export async function runUpdateInstall({ installDir, channel, headers, envUpdateOrigin }) {
  const origin = resolveUpdateOrigin(envUpdateOrigin, headers);
  if (!origin) {
    const err = new Error(
      'POKER_ADVISOR_UPDATE_ORIGIN is set but is not a valid http(s) URL. Unset it to use the default host or fix the value.',
    );
    err.code = 'NO_ORIGIN';
    throw err;
  }

  const releaseLock = await acquireUpdateLock(installDir);
  let tmpRoot = null;
  try {
    const previous = await readLocalAdvisorVersion(installDir);
    const manifest = await fetchRemoteManifest(origin);
    const entry = getManifestChannel(manifest, channel);
    if (!isRemoteNewer(previous.version, entry.version, channel)) {
      return {
        ok: true,
        alreadyLatest: true,
        previousVersion: previous.version,
        newVersion: entry.version,
        restartRequired: false,
      };
    }

    tmpRoot = await mkdtemp(join(tmpdir(), 'poker-advisor-up-'));
    const zipFile = join(tmpRoot, 'bundle.zip');
    const extractRoot = join(tmpRoot, 'extracted');

    const url = zipUrl(origin, entry.zipPath);

    await downloadToFile(url, zipFile);
    await mkdir(extractRoot, { recursive: true });
    await extractZipArchive(zipFile, extractRoot);

    const inner = join(extractRoot, 'poker-local-advisor');
    await cp(inner, installDir, { recursive: true });

    const updated = await readLocalAdvisorVersion(installDir);

    const out = {
      ok: true,
      alreadyLatest: false,
      previousVersion: previous.version,
      newVersion: updated.version,
      restartRequired: true,
    };

    if (process.env.POKER_ADVISOR_AUTO_RESTART === '1') {
      const child = spawn(process.execPath, process.argv.slice(1), {
        cwd: process.cwd(),
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      setTimeout(() => process.exit(0), 300);
    }

    return out;
  } finally {
    await releaseLock();
    if (tmpRoot) {
      await rm(tmpRoot, { recursive: true, force: true });
    }
  }
}

/**
 * @param {string} importMetaUrl
 */
export function defaultInstallDir(importMetaUrl) {
  return fileURLToPath(new URL('.', importMetaUrl));
}
