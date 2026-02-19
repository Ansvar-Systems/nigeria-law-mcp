/**
 * Response metadata utilities for Nigeria Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  return {
    data_source: 'Laws of the Federation of Nigeria (lfrn.gov.ng) + NigeriaLII (nigerialii.org)',
    jurisdiction: 'NG',
    disclaimer:
      'This data is sourced from the Laws of the Federation of Nigeria and NigeriaLII under Government Public Data principles. ' +
      'The legal language is English. ' +
      'Always verify with the official LFRN portal (lfrn.gov.ng) or the Federal Gazette for authoritative text.',
    freshness,
  };
}
