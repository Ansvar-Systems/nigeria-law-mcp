#!/usr/bin/env tsx
/**
 * Nigeria Law MCP -- Full Corpus Ingestion Pipeline
 *
 * Phase 1 (Discovery): Scrapes all pages of the PLAC index (placng.org/lawsofnigeria/)
 *   to build a complete inventory of Nigerian federal acts with HTML sources.
 *
 * Phase 2 (Fetch + Parse): Fetches each HTML act page and extracts provisions.
 *   PDF-only acts are recorded as metadata-only (no provision extraction).
 *
 * Phase 3 (Supplement): Adds key acts from curated list that may not appear in PLAC
 *   (e.g., post-2004 legislation from other sources when available).
 *
 * Source: PLAC (placng.org/lawsofnigeria/) -- The Complete 2004 Laws of Nigeria
 *   ~69 pages, ~550 acts, mix of HTML (view2.php?sn=N) and PDF (laws/X.pdf)
 *
 * Other sources probed but currently unavailable (2026-02-26):
 * - LFRN (lfrn.gov.ng) -- completely down
 * - NigeriaLII (nigerialii.org) -- legislation section has 0 documents
 * - NDPC (ndpc.gov.ng) -- NDPA 2023 PDF removed
 * - CERT (cert.gov.ng) -- unreachable
 *
 * Nigerian legislation is Government Public Data.
 *
 * Usage:
 *   npm run ingest                    # Full corpus ingestion (all PLAC pages)
 *   npm run ingest -- --limit 5       # Test with 5 acts
 *   npm run ingest -- --skip-fetch    # Reuse cached pages
 *   npm run ingest -- --skip-discovery # Skip PLAC index scrape, use cached index
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithRateLimit, fetchPLACIndexPage } from './lib/fetcher.js';
import {
  parsePLACHtml,
  parseNigerianActHtml,
  parsePLACIndexPage,
  parsePLACTotalPages,
  KEY_NIGERIAN_ACTS,
  type ActIndexEntry,
  type ParsedAct,
} from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');
const INDEX_CACHE = path.resolve(__dirname, '../data/plac-index-cache.json');

function parseArgs(): { limit: number | null; skipFetch: boolean; skipDiscovery: boolean } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;
  let skipDiscovery = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    } else if (args[i] === '--skip-discovery') {
      skipDiscovery = true;
    }
  }

  return { limit, skipFetch, skipDiscovery };
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

/**
 * Phase 1: Discover all acts from the PLAC index.
 * Scrapes all paginated index pages and builds a complete list.
 */
async function discoverActsFromPLAC(skipDiscovery: boolean): Promise<ActIndexEntry[]> {
  // Check for cached index
  if (skipDiscovery && fs.existsSync(INDEX_CACHE)) {
    console.log('  Using cached PLAC index...');
    const cached = JSON.parse(fs.readFileSync(INDEX_CACHE, 'utf-8')) as ActIndexEntry[];
    console.log(`  Loaded ${cached.length} acts from cache`);
    return cached;
  }

  console.log('\n  Phase 1: Discovering acts from PLAC index...');

  // Fetch page 1 to determine total pages
  const page1 = await fetchPLACIndexPage(1);
  if (page1.status !== 200) {
    throw new Error(`Failed to fetch PLAC index page 1: HTTP ${page1.status}`);
  }

  const totalPages = parsePLACTotalPages(page1.body);
  console.log(`  Total index pages: ${totalPages}`);

  const allActs: ActIndexEntry[] = [];
  const seenIds = new Set<string>();

  // Parse page 1
  const page1Acts = parsePLACIndexPage(page1.body);
  for (const act of page1Acts) {
    if (!seenIds.has(act.id)) {
      seenIds.add(act.id);
      allActs.push(act);
    }
  }
  console.log(`  Page 1: ${page1Acts.length} acts (total: ${allActs.length})`);

  // Fetch remaining pages
  for (let page = 2; page <= totalPages; page++) {
    try {
      const result = await fetchPLACIndexPage(page);
      if (result.status !== 200) {
        console.log(`  Page ${page}: HTTP ${result.status} -- skipped`);
        continue;
      }

      const pageActs = parsePLACIndexPage(result.body);
      let added = 0;
      for (const act of pageActs) {
        if (!seenIds.has(act.id)) {
          seenIds.add(act.id);
          allActs.push(act);
          added++;
        }
      }
      console.log(`  Page ${page}/${totalPages}: ${pageActs.length} entries, ${added} new (total: ${allActs.length})`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  Page ${page}: ERROR -- ${msg}`);
    }
  }

  // Cache the discovered index
  fs.mkdirSync(path.dirname(INDEX_CACHE), { recursive: true });
  fs.writeFileSync(INDEX_CACHE, JSON.stringify(allActs, null, 2));
  console.log(`\n  Discovery complete: ${allActs.length} acts found`);
  console.log(`  HTML (parseable): ${allActs.filter(a => a.sourceType === 'plac_html').length}`);
  console.log(`  PDF (metadata-only): ${allActs.filter(a => a.sourceType === 'plac_pdf').length}`);

  return allActs;
}

/**
 * Phase 2 (Supplement): Merge curated acts that are not in the PLAC index.
 * These are post-2004 acts or acts from alternative sources.
 */
function mergeSupplementalActs(discovered: ActIndexEntry[]): ActIndexEntry[] {
  const existingIds = new Set(discovered.map(a => a.id));
  const merged = [...discovered];
  let added = 0;

  for (const act of KEY_NIGERIAN_ACTS) {
    if (!existingIds.has(act.id)) {
      merged.push(act);
      existingIds.add(act.id);
      added++;
    }
  }

  if (added > 0) {
    console.log(`\n  Supplemental acts added: ${added} (from curated list)`);
  }

  return merged;
}

async function fetchAndParseActs(acts: ActIndexEntry[], skipFetch: boolean): Promise<void> {
  console.log(`\nPhase 2: Processing ${acts.length} federal acts...\n`);

  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  let processed = 0;
  let withProvisions = 0;
  let metadataOnly = 0;
  let skippedPdf = 0;
  let failed = 0;
  let unavailable = 0;
  let cached = 0;
  let totalProvisions = 0;
  const results: { id: string; shortName: string; provisions: number; status: string; source: string }[] = [];

  for (const act of acts) {
    const sourceFile = path.join(SOURCE_DIR, `${act.id}.html`);
    const seedFile = path.join(SEED_DIR, `${act.id}.json`);

    // Skip unavailable sources with clear reporting
    if (act.sourceType === 'unavailable') {
      // Still create a metadata-only seed file for unavailable acts
      const metaSeed: ParsedAct = {
        id: act.id,
        type: 'statute',
        title: act.title,
        title_en: act.titleEn,
        short_name: act.shortName,
        status: act.status,
        issued_date: act.issuedDate,
        in_force_date: act.inForceDate,
        url: act.canonicalUrl || act.url,
        description: act.description,
        provisions: [],
        definitions: [],
      };
      fs.writeFileSync(seedFile, JSON.stringify(metaSeed, null, 2));
      unavailable++;
      metadataOnly++;
      processed++;
      results.push({
        id: act.id,
        shortName: act.shortName,
        provisions: 0,
        status: 'metadata_only',
        source: act.url,
      });
      continue;
    }

    // Skip PDF sources -- create metadata-only seed
    if (act.sourceType === 'plac_pdf') {
      const metaSeed: ParsedAct = {
        id: act.id,
        type: 'statute',
        title: act.title,
        title_en: act.titleEn,
        short_name: act.shortName,
        status: act.status,
        issued_date: act.issuedDate,
        in_force_date: act.inForceDate,
        url: act.canonicalUrl || act.url,
        description: act.description || 'PDF source -- provision text not extracted',
        provisions: [],
        definitions: [],
      };
      fs.writeFileSync(seedFile, JSON.stringify(metaSeed, null, 2));
      skippedPdf++;
      metadataOnly++;
      processed++;
      results.push({
        id: act.id,
        shortName: act.shortName,
        provisions: 0,
        status: 'metadata_only_pdf',
        source: act.url,
      });
      continue;
    }

    // Skip if seed already exists and we're in skip-fetch mode
    if (skipFetch && fs.existsSync(seedFile)) {
      const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8')) as ParsedAct;
      const provCount = existing.provisions?.length ?? 0;
      totalProvisions += provCount;
      cached++;
      if (provCount > 0) withProvisions++;
      else metadataOnly++;
      processed++;
      results.push({
        id: act.id,
        shortName: act.shortName,
        provisions: provCount,
        status: provCount > 0 ? 'cached' : 'cached_no_provisions',
        source: act.url,
      });
      continue;
    }

    try {
      let html: string;

      if (fs.existsSync(sourceFile) && skipFetch) {
        html = fs.readFileSync(sourceFile, 'utf-8');
      } else {
        process.stdout.write(`  [${processed + 1}/${acts.length}] Fetching ${act.shortName}...`);
        const result = await fetchWithRateLimit(act.url, act.sourceType as any);

        if (result.status !== 200) {
          console.log(` HTTP ${result.status}`);
          // Create metadata-only seed for failed fetches
          const metaSeed: ParsedAct = {
            id: act.id,
            type: 'statute',
            title: act.title,
            title_en: act.titleEn,
            short_name: act.shortName,
            status: act.status,
            issued_date: act.issuedDate,
            in_force_date: act.inForceDate,
            url: act.canonicalUrl || act.url,
            description: `Fetch failed (HTTP ${result.status})`,
            provisions: [],
            definitions: [],
          };
          fs.writeFileSync(seedFile, JSON.stringify(metaSeed, null, 2));
          failed++;
          metadataOnly++;
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

      if (parsed.provisions.length > 0) {
        withProvisions++;
        console.log(`    -> ${parsed.provisions.length} provisions, ${defCount} definitions`);
      } else {
        metadataOnly++;
        console.log(`    -> 0 provisions (metadata-only)`);
      }

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
  console.log(`\n  Total acts processed: ${processed}`);
  console.log(`  With provisions (full text): ${withProvisions}`);
  console.log(`  Metadata-only (no provisions): ${metadataOnly}`);
  console.log(`    - PDF sources: ${skippedPdf}`);
  console.log(`    - Unavailable sources: ${unavailable}`);
  console.log(`    - Parse failures: ${results.filter(r => r.status === 'no_provisions').length}`);
  console.log(`  Cached (reused): ${cached}`);
  console.log(`  Failed fetches: ${failed}`);
  console.log(`  Total provisions extracted: ${totalProvisions}`);

  // Summary table (only first 30 + summary for brevity)
  const showFull = results.length <= 50;
  const displayResults = showFull ? results : results.slice(0, 30);

  console.log(`\n  Per-act breakdown${showFull ? '' : ' (first 30 of ' + results.length + ')'}:`);
  console.log(`  ${'Act'.padEnd(42)} ${'Prov'.padEnd(6)} ${'Status'.padEnd(22)} Source`);
  console.log(`  ${'-'.repeat(40)} ${'-'.repeat(5)} ${'-'.repeat(20)} ${'-'.repeat(50)}`);
  for (const r of displayResults) {
    const provStr = r.provisions > 0 ? String(r.provisions) : '-';
    const shortSrc = r.source.length > 50 ? r.source.substring(0, 50) + '...' : r.source;
    console.log(`  ${r.shortName.substring(0, 42).padEnd(42)} ${provStr.padEnd(6)} ${r.status.padEnd(22)} ${shortSrc}`);
  }

  if (!showFull) {
    const remaining = results.slice(30);
    const withProv = remaining.filter(r => r.provisions > 0).length;
    console.log(`  ... and ${remaining.length} more (${withProv} with provisions)`);
  }

  // Write ingestion metadata
  const metaPath = path.join(SEED_DIR, '_ingestion-meta.json');
  fs.writeFileSync(metaPath, JSON.stringify({
    ingested_at: new Date().toISOString(),
    pipeline: 'full-corpus-plac',
    total_acts: processed,
    with_provisions: withProvisions,
    metadata_only: metadataOnly,
    total_provisions: totalProvisions,
    pdf_sources: skippedPdf,
    unavailable_sources: unavailable,
    cached: cached,
    failed: failed,
    results,
    source_status: {
      plac_html: 'WORKING -- placng.org/lawsofnigeria/view2.php (full corpus, ~550 acts)',
      plac_pdf: 'WORKING but not parsed (no PDF library)',
      nigerialii: 'DOWN -- 0 legislation documents (verified 2026-02-26)',
      lfrn: 'DOWN -- no response from lfrn.gov.ng',
      ndpc: 'PARTIAL -- NDPA 2023 PDF removed (404)',
      cert: 'DOWN -- unreachable',
    },
  }, null, 2));

  console.log(`\n  Metadata written to: ${metaPath}`);
}

async function main(): Promise<void> {
  const { limit, skipFetch, skipDiscovery } = parseArgs();

  console.log('Nigeria Law MCP -- Full Corpus Ingestion Pipeline');
  console.log('=================================================\n');
  console.log('  Primary source: PLAC (placng.org/lawsofnigeria/)');
  console.log('    HTML (view2.php?sn=N) -- full text with sections');
  console.log('    PDF  (laws/X.pdf)     -- metadata only (no parsing)');
  console.log('  Unavailable sources:');
  console.log('    lfrn.gov.ng     -- DOWN (no response)');
  console.log('    nigerialii.org  -- 0 legislation docs');
  console.log('    ndpc.gov.ng     -- NDPA PDF removed');
  console.log('    cert.gov.ng     -- unreachable');
  console.log(`  License: Government Public Data`);

  if (limit) console.log(`  --limit ${limit}`);
  if (skipFetch) console.log(`  --skip-fetch`);
  if (skipDiscovery) console.log(`  --skip-discovery`);

  // Phase 1: Discover all acts from PLAC
  let discoveredActs = await discoverActsFromPLAC(skipDiscovery);

  // Phase 2: Merge supplemental curated acts
  discoveredActs = mergeSupplementalActs(discoveredActs);

  // Apply limit if specified
  const acts = limit ? discoveredActs.slice(0, limit) : discoveredActs;

  // Phase 3: Fetch and parse
  await fetchAndParseActs(acts, skipFetch);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
