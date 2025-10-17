const { writeFileSync, mkdirSync } = require('fs');
const { resolve } = require('path');

try {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || process.env.COMMIT_SHA || '';
  const branch = process.env.VERCEL_GIT_COMMIT_REF || process.env.GITHUB_REF || '';
  const buildTime = new Date().toISOString();
  const outDir = resolve(process.cwd(), 'dist', 'spa');
  try { mkdirSync(outDir, { recursive: true }); } catch {}
  const payload = { sha, branch, buildTime };
  writeFileSync(resolve(outDir, 'version.json'), JSON.stringify(payload, null, 2), 'utf8');
  console.log('[write-version.cjs] version.json written:', payload);
} catch (err) {
  console.warn('[write-version.cjs] failed:', err?.message || err);
}