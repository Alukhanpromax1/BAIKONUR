#!/usr/bin/env node
/**
 * Downloads ONE Mars Climate Sounder data product (label + table) from the NASA Planetary Data
 * System Atmospheres Node so the team can inspect it before integrating it into the game.
 *
 * STATUS: this helper has NOT been run successfully. The archive host could not be reached from
 * the environment where the game was built (see RESOURCE_VERIFICATION_REQUIRED.md). It makes no
 * assumptions about the file format: it only downloads the two files you name, stores them
 * unchanged under data-raw/mcs/, and prints the label and the first lines of the table so that
 * column names, units and missing-data constants can be read from the original source.
 *
 * Usage:
 *   node scripts/fetch-mcs-sample.mjs <url-of-.LBL-file> <url-of-.TAB-file>
 *
 * Find the URLs by browsing from
 *   https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/Mars/Mars.html
 * to the MRO Mars Climate Sounder Derived Data Records (DDR) volumes.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [labelUrl, tableUrl] = process.argv.slice(2);
if (!labelUrl || !tableUrl) {
  console.error('Usage: node scripts/fetch-mcs-sample.mjs <label-url> <table-url>');
  process.exit(1);
}
const allowed = ['pds-atmospheres.nmsu.edu', 'atmos.nmsu.edu'];
for (const u of [labelUrl, tableUrl]) {
  if (!allowed.includes(new URL(u).hostname)) {
    console.error(`Refusing to download from ${new URL(u).hostname}: only the PDS Atmospheres Node hosts are accepted.`);
    process.exit(1);
  }
}

const out = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data-raw', 'mcs');
await mkdir(out, { recursive: true });
const retrievedAt = new Date().toISOString();
const files = [];
for (const url of [labelUrl, tableUrl]) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const name = basename(new URL(url).pathname);
  await writeFile(resolve(out, name), bytes);
  files.push({ name, url, bytes: bytes.length });
  console.log(`\n===== ${name} (${bytes.length} bytes) =====`);
  console.log(bytes.toString('latin1').split(/\r?\n/).slice(0, name.toUpperCase().endsWith('.LBL') ? 400 : 40).join('\n'));
}
await writeFile(resolve(out, 'PROVENANCE.json'), JSON.stringify({ source: 'NASA Planetary Data System — Atmospheres Node', retrievedAt, files }, null, 2));
console.log(`\nSaved unchanged to data-raw/mcs/ with PROVENANCE.json (retrieved ${retrievedAt}).`);
console.log('Next: read the label for column names, units and missing-data constants, then follow RESOURCE_VERIFICATION_REQUIRED.md.');
