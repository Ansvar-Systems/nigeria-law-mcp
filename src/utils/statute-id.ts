/**
 * Statute ID resolution for Nigeria Law MCP.
 *
 * Resolves fuzzy document references (titles, Cap numbers, Act names) to database document IDs.
 */

import type Database from '@ansvar/mcp-sqlite';

/**
 * Resolve a document identifier to a database document ID.
 * Supports:
 * - Direct ID match (e.g., "ndpa-2023")
 * - Cap number match (e.g., "Cap C20 LFN")
 * - Act title match (e.g., "Nigeria Data Protection Act 2023", "NDPA 2023")
 * - Short name / abbreviation match (e.g., "CAMA", "NDPA", "NITDA Act")
 */
export function resolveDocumentId(
  db: InstanceType<typeof Database>,
  input: string,
): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Direct ID match
  const directMatch = db.prepare(
    'SELECT id FROM legal_documents WHERE id = ?'
  ).get(trimmed) as { id: string } | undefined;
  if (directMatch) return directMatch.id;

  // Cap number match (e.g., "Cap C20 LFN", "Cap C20")
  const capMatch = trimmed.match(/Cap\.?\s*([A-Z]\d+)/i);
  if (capMatch) {
    const capNumber = capMatch[1].toUpperCase();
    const capResult = db.prepare(
      "SELECT id FROM legal_documents WHERE id LIKE ? OR short_name LIKE ? OR title LIKE ? LIMIT 1"
    ).get(`%${capNumber}%`, `%Cap ${capNumber}%`, `%Cap ${capNumber}%`) as { id: string } | undefined;
    if (capResult) return capResult.id;
  }

  // Title/short_name fuzzy match
  const titleResult = db.prepare(
    "SELECT id FROM legal_documents WHERE title LIKE ? OR short_name LIKE ? OR title_en LIKE ? LIMIT 1"
  ).get(`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`) as { id: string } | undefined;
  if (titleResult) return titleResult.id;

  // Case-insensitive fallback
  const lowerResult = db.prepare(
    "SELECT id FROM legal_documents WHERE LOWER(title) LIKE LOWER(?) OR LOWER(short_name) LIKE LOWER(?) OR LOWER(title_en) LIKE LOWER(?) LIMIT 1"
  ).get(`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`) as { id: string } | undefined;
  if (lowerResult) return lowerResult.id;

  return null;
}
