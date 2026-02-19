#!/usr/bin/env tsx
/**
 * Nigeria Law MCP -- Ingestion Pipeline
 *
 * Fetches Nigerian federal legislation from verified working sources:
 * - PLAC (placng.org/lawsofnigeria/) -- 2004 Laws of Nigeria compendium (HTML + PDF)
 * - NITDA (nitda.gov.ng) -- NITDA Act page
 *
 * Sources probed but currently unavailable (2026-02-19):
 * - LFRN (lfrn.gov.ng) -- completely down
 * - NigeriaLII (nigerialii.org) -- 0 legislation docs, AKN URLs return 404
 * - NDPC (ndpc.gov.ng) -- NDPA 2023 PDF removed
 * - CERT (cert.gov.ng) -- unreachable
 *
 * Nigerian legislation is Government Public Data.
 *
 * Usage:
 *   npm run ingest                    # Full ingestion
 *   npm run ingest -- --limit 5       # Test with 5 acts
 *   npm run ingest -- --skip-fetch    # Reuse cached pages
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithRateLimit } from './lib/fetcher.js';
import {
  parsePLACHtml,
  parseNigerianActHtml,
  KEY_NIGERIAN_ACTS,
  type ActIndexEntry,
  type ParsedAct,
} from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');

function parseArgs(): { limit: number | null; skipFetch: boolean } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    }
  }

  return { limit, skipFetch };
}

/**
 * Select the appropriate parser based on the source type.
 */
function parseAct(html: string, act: ActIndexEntry): ParsedAct {
  switch (act.sourceType) {
    case 'plac_html':
      return parsePLACHtml(html, act);
    default:
      // Generic parser for NigeriaLII/LFRN/other HTML sources
      return parseNigerianActHtml(html, act);
  }
}

async function fetchAndParseActs(acts: ActIndexEntry[], skipFetch: boolean): Promise<void> {
  console.log(`\nProcessing ${acts.length} federal acts...\n`);

  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let unavailable = 0;
  let totalProvisions = 0;
  const results: { id: string; shortName: string; provisions: number; status: string; source: string }[] = [];

  for (const act of acts) {
    const sourceFile = path.join(SOURCE_DIR, `${act.id}.html`);
    const seedFile = path.join(SEED_DIR, `${act.id}.json`);

    // Skip unavailable sources with clear reporting
    if (act.sourceType === 'unavailable') {
      console.log(`  SKIP ${act.shortName} (${act.id}) -- source unavailable`);
      unavailable++;
      processed++;
      results.push({
        id: act.id,
        shortName: act.shortName,
        provisions: 0,
        status: 'unavailable',
        source: act.url,
      });
      continue;
    }

    // Skip PDF sources (we can't parse them without a PDF library)
    if (act.sourceType === 'plac_pdf') {
      console.log(`  SKIP ${act.shortName} (${act.id}) -- PDF source (not parsed)`);
      skipped++;
      processed++;
      results.push({
        id: act.id,
        shortName: act.shortName,
        provisions: 0,
        status: 'skipped_pdf',
        source: act.url,
      });
      continue;
    }

    // Skip if seed already exists and we're in skip-fetch mode
    if (skipFetch && fs.existsSync(seedFile)) {
      const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8')) as ParsedAct;
      const provCount = existing.provisions?.length ?? 0;
      console.log(`  CACHED ${act.shortName} (${act.id}) -- ${provCount} provisions`);
      totalProvisions += provCount;
      skipped++;
      processed++;
      results.push({
        id: act.id,
        shortName: act.shortName,
        provisions: provCount,
        status: 'cached',
        source: act.url,
      });
      continue;
    }

    try {
      let html: string;

      if (fs.existsSync(sourceFile) && skipFetch) {
        html = fs.readFileSync(sourceFile, 'utf-8');
      } else {
        process.stdout.write(`  Fetching ${act.shortName} (${act.id})...`);
        const result = await fetchWithRateLimit(act.url, act.sourceType);

        if (result.status !== 200) {
          console.log(` HTTP ${result.status} -- FAILED`);
          failed++;
          processed++;
          results.push({
            id: act.id,
            shortName: act.shortName,
            provisions: 0,
            status: `http_${result.status}`,
            source: act.url,
          });
          continue;
        }

        html = result.body;
        fs.writeFileSync(sourceFile, html);
        console.log(` OK (${(html.length / 1024).toFixed(0)} KB)`);
      }

      const parsed = parseAct(html, act);
      fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));
      totalProvisions += parsed.provisions.length;
      const defCount = parsed.definitions?.length ?? 0;
      console.log(`    -> ${parsed.provisions.length} provisions, ${defCount} definitions extracted`);

      results.push({
        id: act.id,
        shortName: act.shortName,
        provisions: parsed.provisions.length,
        status: parsed.provisions.length > 0 ? 'ok' : 'no_provisions',
        source: act.url,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR parsing ${act.shortName}: ${msg}`);
      failed++;
      results.push({
        id: act.id,
        shortName: act.shortName,
        provisions: 0,
        status: `error: ${msg.substring(0, 80)}`,
        source: act.url,
      });
    }

    processed++;
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('INGESTION REPORT');
  console.log('='.repeat(70));
  console.log(`\n  Processed: ${processed}`);
  console.log(`  Successful: ${results.filter(r => r.status === 'ok').length}`);
  console.log(`  Cached (reused): ${skipped}`);
  console.log(`  Unavailable sources: ${unavailable}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total provisions: ${totalProvisions}`);

  console.log(`\n  Per-act breakdown:`);
  console.log(`  ${'Act'.padEnd(30)} ${'Provisions'.padEnd(12)} ${'Status'.padEnd(20)} Source`);
  console.log(`  ${'-'.repeat(28)} ${'-'.repeat(10)} ${'-'.repeat(18)} ${'-'.repeat(40)}`);
  for (const r of results) {
    const provStr = r.provisions > 0 ? String(r.provisions) : '-';
    console.log(`  ${r.shortName.padEnd(30)} ${provStr.padEnd(12)} ${r.status.padEnd(20)} ${r.source.substring(0, 60)}`);
  }

  // Write ingestion metadata
  const metaPath = path.join(SEED_DIR, '_ingestion-meta.json');
  fs.writeFileSync(metaPath, JSON.stringify({
    ingested_at: new Date().toISOString(),
    total_acts_attempted: processed,
    total_acts_succeeded: results.filter(r => r.status === 'ok').length,
    total_provisions: totalProvisions,
    unavailable_sources: unavailable,
    failed: failed,
    results,
    source_status: {
      plac_html: 'WORKING -- placng.org/lawsofnigeria/view2.php',
      plac_pdf: 'WORKING but not parsed (no PDF library)',
      nigerialii: 'DOWN -- 0 legislation documents, AKN URLs return 404',
      lfrn: 'DOWN -- no response from lfrn.gov.ng',
      ndpc: 'PARTIAL -- NDPA 2023 PDF removed (404)',
      cert: 'DOWN -- unreachable',
    },
  }, null, 2));

  console.log(`\n  Metadata written to: ${metaPath}`);
}

async function main(): Promise<void> {
  const { limit, skipFetch } = parseArgs();

  console.log('Nigeria Law MCP -- Ingestion Pipeline');
  console.log('=====================================\n');
  console.log('  Verified sources:');
  console.log('    PLAC HTML (placng.org/lawsofnigeria/view2.php) -- WORKING');
  console.log('    PLAC PDF  (placng.org/lawsofnigeria/laws/)     -- WORKING (not parsed)');
  console.log('  Unavailable sources:');
  console.log('    lfrn.gov.ng     -- DOWN (no response)');
  console.log('    nigerialii.org  -- 0 legislation docs');
  console.log('    ndpc.gov.ng     -- NDPA PDF removed');
  console.log('    cert.gov.ng     -- unreachable');
  console.log(`  License: Government Public Data`);

  if (limit) console.log(`  --limit ${limit}`);
  if (skipFetch) console.log(`  --skip-fetch`);

  const acts = limit ? KEY_NIGERIAN_ACTS.slice(0, limit) : KEY_NIGERIAN_ACTS;
  await fetchAndParseActs(acts, skipFetch);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
