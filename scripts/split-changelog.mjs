import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHANGELOG_DIR = join(ROOT, 'public', 'docs', 'changelog');
const LANGUAGES = ['zh', 'en', 'ja'];

const VERSION_HEADING = /^## \[([^\]]+)\]\s*-\s*(\d{4}-\d{2}-\d{2})\s*$/m;

function isPreRelease(version) {
  return version.includes('-') || version.includes('beta') || version.includes('alpha');
}

function extractSummary(body) {
  const match = body.match(/^>\s*(.+?)(?:\n\n|\n$|$)/s);
  if (!match) return '';
  return match[1].replace(/\s+/g, ' ').trim();
}

function splitOne(language) {
  const sourcePath = join(CHANGELOG_DIR, `${language}.md`);
  const outDir = join(CHANGELOG_DIR, language);

  let raw;
  try {
    raw = readFileSync(sourcePath, 'utf8');
  } catch (err) {
    console.warn(`[split-changelog] Skipping ${language}: ${err.message}`);
    return;
  }

  const versionRegex = /^## \[([^\]]+)\]\s*-\s*(\d{4}-\d{2}-\d{2})\s*$/gm;
  const matches = [];
  let m;
  while ((m = versionRegex.exec(raw)) !== null) {
    matches.push({ index: m.index, version: m[1], date: m[2] });
  }

  if (matches.length === 0) {
    console.warn(`[split-changelog] No version headings found in ${sourcePath}`);
    return;
  }

  // Reset & recreate output directory so renamed/removed versions don't leak.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const entries = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : raw.length;
    const block = raw.slice(start, end).trimEnd() + '\n';

    const headingEnd = block.indexOf('\n');
    const body = block.slice(headingEnd + 1).replace(/^\s*\n/, '');

    const { version, date } = matches[i];
    const summary = extractSummary(body);

    writeFileSync(join(outDir, `${version}.md`), block);
    entries.push({
      version,
      date,
      isPreRelease: isPreRelease(version),
      summary,
    });
  }

  writeFileSync(
    join(outDir, 'index.json'),
    JSON.stringify({ versions: entries }, null, 2) + '\n',
  );

  console.log(`[split-changelog] ${language}: wrote ${entries.length} version files + index.json`);
}

function main() {
  try {
    readdirSync(CHANGELOG_DIR);
  } catch (err) {
    console.error(`[split-changelog] Cannot read ${CHANGELOG_DIR}: ${err.message}`);
    process.exit(1);
  }

  for (const lang of LANGUAGES) {
    splitOne(lang);
  }
}

main();
