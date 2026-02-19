/**
 * list_sources — Return provenance metadata for all data sources.
 */

import type Database from '@ansvar/mcp-sqlite';
import { readDbMetadata } from '../capabilities.js';
import { generateResponseMetadata, type ToolResponse } from '../utils/metadata.js';

export interface SourceInfo {
  name: string;
  authority: string;
  url: string;
  license: string;
  coverage: string;
  languages: string[];
}

export interface ListSourcesResult {
  sources: SourceInfo[];
  database: {
    tier: string;
    schema_version: string;
    built_at?: string;
    document_count: number;
    provision_count: number;
  };
}

function safeCount(db: InstanceType<typeof Database>, sql: string): number {
  try {
    const row = db.prepare(sql).get() as { count: number } | undefined;
    return row ? Number(row.count) : 0;
  } catch {
    return 0;
  }
}

export async function listSources(
  db: InstanceType<typeof Database>,
): Promise<ToolResponse<ListSourcesResult>> {
  const meta = readDbMetadata(db);

  return {
    results: {
      sources: [
        {
          name: 'Laws of the Federation of Nigeria (LFRN)',
          authority: 'Federal Ministry of Justice, Federal Republic of Nigeria',
          url: 'https://lfrn.gov.ng',
          license: 'Government Public Data',
          coverage:
            'All federal Acts of the National Assembly and extant legislation of the Federation of Nigeria, ' +
            'including the Nigeria Data Protection Act (NDPA) 2023, Cybercrimes Act 2015, ' +
            'Companies and Allied Matters Act (CAMA) 2020, NITDA Act 2007, and the Constitution of Nigeria 1999',
          languages: ['en'],
        },
        {
          name: 'Nigerian Legal Information Institute (NigeriaLII)',
          authority: 'AfricanLII (African Legal Information Institute)',
          url: 'https://nigerialii.org',
          license: 'Free Access (AfricanLII Terms)',
          coverage:
            'Federal legislation, superior court decisions, subsidiary legislation and regulations. ' +
            'Provides reliable open access to Nigerian legal information as a supplement to official LFRN portal.',
          languages: ['en'],
        },
      ],
      database: {
        tier: meta.tier,
        schema_version: meta.schema_version,
        built_at: meta.built_at,
        document_count: safeCount(db, 'SELECT COUNT(*) as count FROM legal_documents'),
        provision_count: safeCount(db, 'SELECT COUNT(*) as count FROM legal_provisions'),
      },
    },
    _metadata: generateResponseMetadata(db),
  };
}
