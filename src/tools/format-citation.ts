/**
 * format_citation — Format a Nigerian legal citation per standard conventions.
 */

import { generateResponseMetadata, type ToolResponse } from '../utils/metadata.js';
import type Database from '@ansvar/mcp-sqlite';

export interface FormatCitationInput {
  citation: string;
  format?: 'full' | 'short' | 'pinpoint';
}

export interface FormatCitationResult {
  original: string;
  formatted: string;
  format: string;
}

export async function formatCitationTool(
  input: FormatCitationInput,
): Promise<FormatCitationResult> {
  const format = input.format ?? 'full';
  const trimmed = input.citation.trim();

  // Parse "Section N <law>" or "<law> Section N" or "s N <law>"
  const secFirst = trimmed.match(/^(?:Section|s\.?)\s*(\d+[a-zA-Z]*(?:\(\d+\))?)\s*[,;]?\s*(.+)$/i);
  const secLast = trimmed.match(/^(.+?)[,;]?\s*(?:Section|s\.?)\s*(\d+[a-zA-Z]*(?:\(\d+\))?)$/i);

  const section = secFirst?.[1] ?? secLast?.[2];
  const law = secFirst?.[2] ?? secLast?.[1] ?? trimmed;

  let formatted: string;
  switch (format) {
    case 'short':
      formatted = section ? `s ${section} ${law.split('(')[0].trim()}` : law;
      break;
    case 'pinpoint':
      formatted = section ? `s ${section}` : law;
      break;
    case 'full':
    default:
      formatted = section ? `Section ${section}, ${law}` : law;
      break;
  }

  return { original: input.citation, formatted, format };
}
