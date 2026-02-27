/**
 * HTML parser for Nigerian legislation from PLAC (placng.org/lawsofnigeria/).
 *
 * Parses the HTML structure of PLAC view2.php pages into structured seed JSON.
 * PLAC hosts the 2004 Laws of Nigeria as HTML with section-by-section content.
 *
 * Verified working sources (2026-02-19):
 * - PLAC HTML (view2.php?sn=N) -- full-text acts with numbered sections
 * - PLAC PDF (laws/X.pdf) -- PDF versions (not parsed here; HTML preferred)
 *
 * Sources currently unavailable:
 * - NigeriaLII -- legislation section has 0 documents; AKN URLs return 404
 * - LFRN -- portal completely down
 * - NDPC -- NDPA 2023 PDF URL removed from site
 * - CERT.gov.ng -- unreachable
 */

export interface ActIndexEntry {
  id: string;
  title: string;
  titleEn: string;
  shortName: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issuedDate: string;
  inForceDate: string;
  /** Primary URL for this act */
  url: string;
  /**
   * Source type determines which parser to use.
   * - plac_html: PLAC view2.php page (sn parameter in url)
   * - plac_pdf: PLAC laws/*.pdf (not parsed, generates stub)
   * - unavailable: Source known but currently unreachable
   */
  sourceType: 'plac_html' | 'plac_pdf' | 'unavailable';
  /** Canonical reference URL (for display/citation, may differ from fetch URL) */
  canonicalUrl?: string;
  /** Description of the act's relevance to cybersecurity/compliance */
  description?: string;
}

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title: string;
  title_en: string;
  short_name: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issued_date: string;
  in_force_date: string;
  url: string;
  description?: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

/**
 * Extract text content from an HTML element, stripping tags.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '--')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract the main content area from a PLAC view2.php page.
 *
 * PLAC pages have TWO parts:
 * 1. Table of Contents: <li value="N">Short title</li> entries
 * 2. Full Act Text: starts after "ENACTED by the National Assembly" or
 *    after the act's long title heading, with actual section content
 *
 * We skip the TOC and return only the full text part.
 */
function extractPLACContent(html: string): string {
  // First, extract the content area from the page wrapper
  let content = html;

  // Try to find the field-item div (PLAC's content wrapper)
  const fieldItemMatch = html.match(/<div class="field-item even">([\s\S]*)/);
  if (fieldItemMatch) {
    content = fieldItemMatch[1];
  }

  // Find the boundary between TOC and full text.
  // Nigerian Acts have "ENACTED by the National Assembly" before the full text starts.
  const enactedIdx = content.search(/ENACTED\s+by\s+the\s+National\s+Assembly/i);
  if (enactedIdx > 0) {
    content = content.substring(enactedIdx);
  } else {
    // Fallback: look for "An Act to" or "An Act for" (the long title, which comes just before sections)
    const longTitleIdx = content.search(/<p>\s*<strong>\s*An\s+Act\s+(?:to|for)/i);
    if (longTitleIdx > 0) {
      content = content.substring(longTitleIdx);
    } else {
      // Second fallback: look for "[Commencement" which appears just before sections
      const commencementIdx = content.search(/\[Commencement/i);
      if (commencementIdx > 0) {
        content = content.substring(commencementIdx);
      }
    }
  }

  // Trim everything after the footer/newsletter section
  const footerIdx = content.search(/<div\s+id="(?:newsletter|footer|socialmedia|copyright)"/i);
  if (footerIdx > 0) {
    content = content.substring(0, footerIdx);
  }

  return content;
}

/**
 * Parse PLAC HTML (view2.php format) to extract provisions from a statute page.
 *
 * PLAC HTML structure (after TOC, in the full text part):
 * Pattern 1: <li value="N"><strong>Title</strong></li> followed by <p> paragraphs
 * Pattern 2: <p><strong>N. Title</strong></p> followed by <p> paragraphs
 * Pattern 3: <p><strong>Section N. Title</strong></p> followed by <p> paragraphs
 * Pattern 4: Some sections inside <table> elements
 *
 * Sections are separated by <ol>/<li> or <p><strong> boundaries.
 */
export function parsePLACHtml(html: string, act: ActIndexEntry): ParsedAct {
  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];

  const content = extractPLACContent(html);

  // Find section boundaries using multiple patterns observed in real PLAC HTML.
  // We look for:
  // 1. <li value="N"><strong>Title</strong> (most common in full text)
  // 2. <strong>N. Title</strong> inside <p> or <td>
  // 3. <li><strong>Title</strong> (section 1, which often has no value= attribute)
  const sections: { num: string; title: string; start: number }[] = [];
  let match: RegExpExecArray | null;

  // Pattern 1: <li value="N"><strong>Title</strong>
  const liValuePattern = /<li\s+value="(\d+)"[^>]*>\s*<strong>([^<]+)<\/strong>/gi;
  while ((match = liValuePattern.exec(content)) !== null) {
    sections.push({
      num: match[1],
      title: stripHtml(match[2]),
      start: match.index,
    });
  }

  // Pattern 2: <strong>N. Title</strong> (in <p> or <td>)
  const strongNumPattern = /<(?:p|td)[^>]*>\s*<strong>\s*(\d+[A-Z]?)\.\s+([^<]+)<\/strong>/gi;
  while ((match = strongNumPattern.exec(content)) !== null) {
    sections.push({
      num: match[1],
      title: stripHtml(match[2]),
      start: match.index,
    });
  }

  // Pattern 3: <strong>Section N. Title</strong>
  const sectionWordPattern = /<strong>\s*Section\s+(\d+[A-Z]?)\.\s+([^<]+)<\/strong>/gi;
  while ((match = sectionWordPattern.exec(content)) !== null) {
    sections.push({
      num: match[1],
      title: stripHtml(match[2]),
      start: match.index,
    });
  }

  // Pattern 4: First section sometimes as <li><strong>Title (no value= attr)
  const firstLiPattern = /<ol>\s*<li>\s*<strong>([^<]+)<\/strong>/gi;
  while ((match = firstLiPattern.exec(content)) !== null) {
    // Only add if we don't already have section 1
    if (!sections.some(s => s.num === '1')) {
      sections.push({
        num: '1',
        title: stripHtml(match[1]),
        start: match.index,
      });
    }
  }

  // Sort by position in document
  sections.sort((a, b) => a.start - b.start);

  // Deduplicate by section number (keep the one with better title or more content context)
  const seenNums = new Map<string, number>();
  const dedupedSections: typeof sections = [];
  for (const s of sections) {
    const existing = seenNums.get(s.num);
    if (existing === undefined) {
      seenNums.set(s.num, dedupedSections.length);
      dedupedSections.push(s);
    } else {
      // Keep the entry with a longer title (likely the full text section, not TOC)
      if (s.title.length > dedupedSections[existing].title.length) {
        dedupedSections[existing] = s;
      }
    }
  }

  // Re-sort after dedup
  dedupedSections.sort((a, b) => a.start - b.start);

  // Extract content between section boundaries
  for (let i = 0; i < dedupedSections.length; i++) {
    const start = dedupedSections[i].start;
    const end = i + 1 < dedupedSections.length
      ? dedupedSections[i + 1].start
      : content.length;
    const chunk = content.substring(start, Math.min(start + 15000, end));
    const text = stripHtml(chunk);
    const sectionNum = dedupedSections[i].num;
    const title = dedupedSections[i].title
      .replace(/^\d+[A-Z]?\.\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length > 20) {
      provisions.push({
        provision_ref: `s${sectionNum}`,
        section: sectionNum,
        title,
        content: text.substring(0, 8000), // Cap at 8K chars
      });

      // Extract definitions from "interpretation" or "definitions" sections
      if (/\b(?:interpretation|definitions?)\b/i.test(title)) {
        extractDefinitions(text, `s${sectionNum}`, definitions);
      }
    }
  }

  // Fallback: if we found very few sections, try a broader regex
  if (provisions.length < 3) {
    provisions.length = 0;
    definitions.length = 0;

    const broadPattern = /(?:Section|s\.?)\s+(\d+[A-Z]?)\b/gi;
    const positions: { num: string; index: number }[] = [];
    const seenBroad = new Set<string>();

    while ((match = broadPattern.exec(content)) !== null) {
      if (!seenBroad.has(match[1])) {
        seenBroad.add(match[1]);
        positions.push({ num: match[1], index: match.index });
      }
    }

    for (let i = 0; i < positions.length; i++) {
      const start = positions[i].index;
      const end = i + 1 < positions.length ? positions[i + 1].index : content.length;
      const chunk = content.substring(start, Math.min(start + 15000, end));
      const text = stripHtml(chunk);
      if (text.length > 20) {
        provisions.push({
          provision_ref: `s${positions[i].num}`,
          section: positions[i].num,
          title: '',
          content: text.substring(0, 8000),
        });
      }
    }
  }

  return {
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
    provisions,
    definitions,
  };
}

/**
 * Parse generic Nigerian Act HTML (NigeriaLII, LFRN, or other sources).
 * Kept as fallback for when NigeriaLII/LFRN come back online.
 */
export function parseNigerianActHtml(html: string, act: ActIndexEntry): ParsedAct {
  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];

  // Split by section boundaries -- Nigerian Acts use "Section N" numbering
  const sectionSections = html.split(/(?=<(?:div|section|h[1-6]|p)[^>]*(?:id=["'](?:sec|section)[_-]|class=["'][^"']*(?:akn-section|section)))/i);

  for (const section of sectionSections) {
    // Try to extract section number -- Nigerian Acts use "Section N" or "s. N"
    const secNumMatch = section.match(/(?:Section|s\.?)\s*(\d+[a-zA-Z]*(?:\(\d+\))?)/i);
    if (!secNumMatch) continue;

    const sectionNum = secNumMatch[1];
    const provisionRef = `s${sectionNum}`;

    // Extract title (usually after the section number in a heading)
    const titleMatch = section.match(/(?:Section|s\.?)\s*\d+[a-zA-Z]*(?:\(\d+\))?\s*[.:\-\u2014]?\s*(?:<[^>]+>)*\s*([^<\n]+)/i);
    const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';

    // Extract content (all text within the section)
    const content = stripHtml(section);

    if (content.length > 10) {
      provisions.push({
        provision_ref: provisionRef,
        section: sectionNum,
        title,
        content: content.substring(0, 8000),
      });
    }
  }

  // Fallback: if no AKN sections found, try simple regex splitting
  if (provisions.length === 0) {
    const simplePattern = /Section\s+(\d+[a-zA-Z]*)\b/gi;
    let match: RegExpExecArray | null;
    const positions: { num: string; index: number }[] = [];

    while ((match = simplePattern.exec(html)) !== null) {
      positions.push({ num: match[1], index: match.index });
    }

    for (let i = 0; i < positions.length; i++) {
      const start = positions[i].index;
      const end = i + 1 < positions.length ? positions[i + 1].index : html.length;
      const chunk = html.substring(start, end);
      const content = stripHtml(chunk);
      const sectionNum = positions[i].num;

      if (content.length > 10) {
        provisions.push({
          provision_ref: `s${sectionNum}`,
          section: sectionNum,
          title: '',
          content: content.substring(0, 8000),
        });
      }
    }
  }

  return {
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
    provisions,
    definitions,
  };
}

/**
 * Extract legal definitions from a section's text content.
 * Nigerian Acts typically have an "Interpretation" section with definitions
 * in the format: '"term" means ...' or '"term" - ...'
 */
function extractDefinitions(
  text: string,
  sourceProvision: string,
  definitions: ParsedDefinition[],
): void {
  // Pattern: "term" means/includes/has the meaning ...
  const defPattern = /["\u201C]([^"\u201D]+)["\u201D]\s*(?:means|includes|has the meaning|refers to)\s+([^;]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = defPattern.exec(text)) !== null) {
    const term = match[1].trim();
    const definition = match[2].trim().replace(/[;.]$/, '');

    if (term.length > 1 && term.length < 100 && definition.length > 5) {
      definitions.push({
        term,
        definition: definition.substring(0, 2000),
        source_provision: sourceProvision,
      });
    }
  }
}

/**
 * Parse a PLAC index page to extract act entries.
 *
 * PLAC index pages list acts as links:
 * - HTML acts: <a href="view2.php?sn=N">ACT TITLE</a>
 * - PDF acts: <a href="laws/X.pdf">ACT TITLE</a>
 *
 * Returns a list of discovered act entries with source types.
 */
export function parsePLACIndexPage(html: string): ActIndexEntry[] {
  const entries: ActIndexEntry[] = [];
  const seen = new Set<string>();

  // PLAC uses both single and double quotes in href attributes.
  // Actual HTML: <a href='view2.php?sn=14' target="_blank">TITLE</a>
  //          or: <a href='laws/A1.pdf' target="_blank">TITLE</a>

  // Pattern 1: HTML acts -- view2.php?sn=N (single or double quotes)
  const htmlPattern = /<a\s+href=['"](view2\.php\?sn=(\d+))['"][^>]*>([^<]+)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = htmlPattern.exec(html)) !== null) {
    const sn = match[2];
    const rawTitle = stripHtml(match[3]).trim();
    if (!rawTitle || rawTitle.length < 3) continue;

    const id = titleToId(rawTitle);
    if (seen.has(id)) continue;
    seen.add(id);

    entries.push({
      id,
      title: rawTitle,
      titleEn: rawTitle,
      shortName: abbreviateTitle(rawTitle),
      status: 'in_force',
      issuedDate: '',
      inForceDate: '',
      url: `https://placng.org/lawsofnigeria/view2.php?sn=${sn}`,
      sourceType: 'plac_html',
      canonicalUrl: `https://placng.org/lawsofnigeria/view2.php?sn=${sn}`,
    });
  }

  // Pattern 2: PDF acts -- laws/X.pdf (single or double quotes, may have URL-encoded spaces)
  const pdfPattern = /<a\s+href=['"]laws\/([^'"]+\.pdf)['"][^>]*>([^<]+)<\/a>/gi;

  while ((match = pdfPattern.exec(html)) !== null) {
    const pdfFile = match[1];
    const rawTitle = stripHtml(match[2]).trim();
    if (!rawTitle || rawTitle.length < 3) continue;

    const id = titleToId(rawTitle);
    if (seen.has(id)) continue;
    seen.add(id);

    entries.push({
      id,
      title: rawTitle,
      titleEn: rawTitle,
      shortName: abbreviateTitle(rawTitle),
      status: 'in_force',
      issuedDate: '',
      inForceDate: '',
      url: `https://placng.org/lawsofnigeria/laws/${encodeURI(decodeURI(pdfFile))}`,
      sourceType: 'plac_pdf',
      canonicalUrl: `https://placng.org/lawsofnigeria/laws/${encodeURI(decodeURI(pdfFile))}`,
    });
  }

  return entries;
}

/**
 * Detect the total number of index pages from a PLAC index page.
 * Looks for the "Last" pagination link: ?page=N
 */
export function parsePLACTotalPages(html: string): number {
  // Look for ?page=N in pagination links -- find the highest number
  const pagePattern = /\?page=(\d+)/g;
  let match: RegExpExecArray | null;
  let maxPage = 1;

  while ((match = pagePattern.exec(html)) !== null) {
    const page = parseInt(match[1], 10);
    if (page > maxPage) maxPage = page;
  }

  return maxPage;
}

/**
 * Convert an act title to a kebab-case ID.
 */
function titleToId(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

/**
 * Generate a short name from a full act title.
 * Removes common suffixes like "Act", "Decree", etc. and abbreviates.
 */
function abbreviateTitle(title: string): string {
  // Truncate to a readable short name (max 40 chars)
  let short = title;
  if (short.length > 40) {
    // Try to cut at a word boundary
    short = short.substring(0, 40);
    const lastSpace = short.lastIndexOf(' ');
    if (lastSpace > 20) {
      short = short.substring(0, lastSpace);
    }
  }
  return short;
}

/**
 * Pre-configured list of key Nigerian federal acts to ingest.
 *
 * Sources verified 2026-02-19:
 * - PLAC HTML: view2.php?sn=N -- WORKING for 2004 Laws of Nigeria
 * - PLAC PDF: laws/X.pdf -- WORKING for 2004 Laws (Evidence Act, Constitution, CAMA)
 * - NigeriaLII: AKN URLs -- NOT WORKING (404), legislation section has 0 docs
 * - LFRN: -- NOT WORKING (site down)
 * - NDPC: -- NDPA 2023 PDF removed
 * - CERT: -- NOT WORKING (unreachable)
 *
 * Acts are ordered by cybersecurity/compliance relevance.
 */
export const KEY_NIGERIAN_ACTS: ActIndexEntry[] = [
  // =====================================================
  // AVAILABLE VIA PLAC HTML (view2.php) -- 2004 LFN versions
  // =====================================================
  {
    id: 'nitda-act-2007',
    title: 'National Information Technology Development Agency Act 2007',
    titleEn: 'National Information Technology Development Agency Act 2007',
    shortName: 'NITDA Act',
    status: 'in_force',
    issuedDate: '2007-04-24',
    inForceDate: '2007-04-24',
    url: 'https://placng.org/lawsofnigeria/view2.php?sn=412',
    sourceType: 'plac_html',
    canonicalUrl: 'https://nitda.gov.ng/nitda-act/',
    description: 'Establishes NITDA as the IT regulatory body; foundation for Nigeria\'s digital governance framework and data protection oversight before NDPA 2023',
  },
  {
    id: 'bofia-2004',
    title: 'Banks and Other Financial Institutions Act',
    titleEn: 'Banks and Other Financial Institutions Act',
    shortName: 'BOFIA',
    status: 'amended', // Replaced by BOFIA 2020 but 2004 version in PLAC
    issuedDate: '1991-06-20',
    inForceDate: '1991-06-20',
    url: 'https://placng.org/lawsofnigeria/view2.php?sn=45',
    sourceType: 'plac_html',
    canonicalUrl: 'https://placng.org/lawsofnigeria/view2.php?sn=45',
    description: 'Regulates banks and financial institutions; cybersecurity obligations for financial sector; predecessor to BOFIA 2020',
  },

  // =====================================================
  // AVAILABLE VIA PLAC PDF -- 2004 LFN versions
  // =====================================================
  {
    id: 'evidence-act-2004',
    title: 'Evidence Act (Cap E14 LFN 2004)',
    titleEn: 'Evidence Act',
    shortName: 'Evidence Act',
    status: 'amended', // Replaced by Evidence Act 2011 but 2004 version available
    issuedDate: '1945-01-01',
    inForceDate: '1945-06-01',
    url: 'https://placng.org/lawsofnigeria/laws/E14.pdf',
    sourceType: 'plac_pdf',
    canonicalUrl: 'https://placng.org/lawsofnigeria/laws/E14.pdf',
    description: 'Governs admissibility of electronic evidence, computer-generated documents; predecessor to Evidence Act 2011',
  },
  {
    id: 'cama-2004',
    title: 'Companies and Allied Matters Act (Cap C20 LFN 2004)',
    titleEn: 'Companies and Allied Matters Act',
    shortName: 'CAMA',
    status: 'amended', // Replaced by CAMA 2020 but 2004 version available
    issuedDate: '1990-01-02',
    inForceDate: '1990-01-02',
    url: 'https://placng.org/lawsofnigeria/laws/C20.pdf',
    sourceType: 'plac_pdf',
    canonicalUrl: 'https://placng.org/lawsofnigeria/laws/C20.pdf',
    description: 'Company registration, governance, and compliance obligations; predecessor to CAMA 2020',
  },
  {
    id: 'constitution-1999',
    title: 'Constitution of the Federal Republic of Nigeria 1999',
    titleEn: 'Constitution of the Federal Republic of Nigeria 1999',
    shortName: 'Constitution 1999',
    status: 'in_force',
    issuedDate: '1999-05-29',
    inForceDate: '1999-05-29',
    url: 'https://placng.org/lawsofnigeria/laws/C23.pdf',
    sourceType: 'plac_pdf',
    canonicalUrl: 'https://placng.org/lawsofnigeria/laws/C23.pdf',
    description: 'Supreme law of Nigeria; Section 37 guarantees right to private and family life (privacy foundation); Section 39 freedom of expression',
  },

  // =====================================================
  // CURRENTLY UNAVAILABLE -- sources down or removed
  // Kept for documentation; ingest will skip these gracefully
  // =====================================================
  {
    id: 'ndpa-2023',
    title: 'Nigeria Data Protection Act 2023',
    titleEn: 'Nigeria Data Protection Act 2023',
    shortName: 'NDPA 2023',
    status: 'in_force',
    issuedDate: '2023-06-12',
    inForceDate: '2023-06-14',
    url: 'https://ndpc.gov.ng/Files/Nigeria_Data_Protection_Act_2023.pdf',
    sourceType: 'unavailable',
    canonicalUrl: 'https://ndpc.gov.ng/',
    description: 'Nigeria\'s primary data protection law; establishes NDPC; regulates processing of personal data; cross-border transfers; replaces NDPR 2019. SOURCE UNAVAILABLE: NDPC removed PDF from website (404 as of 2026-02-19)',
  },
  {
    id: 'cybercrimes-act-2015',
    title: 'Cybercrimes (Prohibition, Prevention, etc.) Act 2015',
    titleEn: 'Cybercrimes (Prohibition, Prevention, etc.) Act 2015',
    shortName: 'Cybercrimes Act 2015',
    status: 'in_force',
    issuedDate: '2015-05-15',
    inForceDate: '2015-05-15',
    url: 'https://www.cert.gov.ng/ngcert/resources/CyberCrime__Prohibition_Prevention_etc__Act__2015.pdf',
    sourceType: 'unavailable',
    canonicalUrl: 'https://www.cert.gov.ng/ngcert/resources/CyberCrime__Prohibition_Prevention_etc__Act__2015.pdf',
    description: 'Criminalises cyber offences, identity theft, computer fraud; mandatory breach reporting; influenced by Budapest Convention. SOURCE UNAVAILABLE: cert.gov.ng unreachable (2026-02-19)',
  },
  {
    id: 'cama-2020',
    title: 'Companies and Allied Matters Act 2020',
    titleEn: 'Companies and Allied Matters Act 2020',
    shortName: 'CAMA 2020',
    status: 'in_force',
    issuedDate: '2020-08-07',
    inForceDate: '2020-08-07',
    url: 'https://nigerialii.org/akn/ng/act/2020/3/eng%402020-08-07',
    sourceType: 'unavailable',
    canonicalUrl: 'https://nigerialii.org/akn/ng/act/2020/3/eng%402020-08-07',
    description: 'Modernised company law; beneficial ownership transparency; digital filing; replaces CAMA 1990. SOURCE UNAVAILABLE: NigeriaLII AKN URL returns 404 (2026-02-19)',
  },
  {
    id: 'fccpa-2018',
    title: 'Federal Competition and Consumer Protection Act 2018',
    titleEn: 'Federal Competition and Consumer Protection Act 2018',
    shortName: 'FCCPA 2018',
    status: 'in_force',
    issuedDate: '2018-12-01',
    inForceDate: '2019-02-01',
    url: 'https://nigerialii.org/akn/ng/act/2018/1/eng%402018-12-01',
    sourceType: 'unavailable',
    canonicalUrl: 'https://nigerialii.org/akn/ng/act/2018/1/eng%402018-12-01',
    description: 'Consumer protection obligations for digital services; data portability provisions. SOURCE UNAVAILABLE: NigeriaLII AKN URL returns 404 (2026-02-19)',
  },
  {
    id: 'evidence-act-2011',
    title: 'Evidence Act 2011',
    titleEn: 'Evidence Act 2011',
    shortName: 'Evidence Act 2011',
    status: 'in_force',
    issuedDate: '2011-06-03',
    inForceDate: '2011-06-03',
    url: 'https://nigerialii.org/akn/ng/act/2011/18/eng%402011-06-03',
    sourceType: 'unavailable',
    canonicalUrl: 'https://nigerialii.org/akn/ng/act/2011/18/eng%402011-06-03',
    description: 'Admissibility of electronic evidence and computer-generated documents; replaces Evidence Act Cap E14. SOURCE UNAVAILABLE: NigeriaLII AKN URL returns 404 (2026-02-19)',
  },
  {
    id: 'bofia-2020',
    title: 'Banks and Other Financial Institutions Act 2020',
    titleEn: 'Banks and Other Financial Institutions Act 2020',
    shortName: 'BOFIA 2020',
    status: 'in_force',
    issuedDate: '2020-11-14',
    inForceDate: '2020-11-14',
    url: 'https://nigerialii.org/akn/ng/act/2020/5/eng%402020-11-14',
    sourceType: 'unavailable',
    canonicalUrl: 'https://nigerialii.org/akn/ng/act/2020/5/eng%402020-11-14',
    description: 'Banking regulation with cybersecurity requirements for financial institutions. SOURCE UNAVAILABLE: NigeriaLII AKN URL returns 404 (2026-02-19)',
  },
  {
    id: 'foi-act-2011',
    title: 'Freedom of Information Act 2011',
    titleEn: 'Freedom of Information Act 2011',
    shortName: 'FOI Act 2011',
    status: 'in_force',
    issuedDate: '2011-05-28',
    inForceDate: '2011-05-28',
    url: 'https://nigerialii.org/akn/ng/act/2011/4/eng%402011-05-28',
    sourceType: 'unavailable',
    canonicalUrl: 'https://nigerialii.org/akn/ng/act/2011/4/eng%402011-05-28',
    description: 'Right of access to public records and information; relevant for transparency and data governance. SOURCE UNAVAILABLE: NigeriaLII AKN URL returns 404 (2026-02-19)',
  },
];
