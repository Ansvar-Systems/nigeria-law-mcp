/**
 * Rate-limited HTTP client for Nigerian legal sources.
 *
 * Verified working sources (as of 2026-02-19):
 * - placng.org/lawsofnigeria/ (PLAC - 2004 Laws of Nigeria compendium)
 *   - HTML: view2.php?sn=N (full text with section structure)
 *   - PDF:  laws/X.pdf (scanned/text PDFs)
 * - nitda.gov.ng (NITDA Act page + PDF download)
 *
 * Sources probed but currently unavailable:
 * - lfrn.gov.ng (LFRN portal) -- completely down, no response
 * - nigerialii.org (NigeriaLII) -- legislation section has 0 documents;
 *   AKN URLs return 404; search is JS-rendered (Vue.js SPA); API requires auth
 * - ndpc.gov.ng -- NDPA 2023 PDF URL removed; site has guidance docs only
 * - cert.gov.ng -- unreachable (DNS/connection failure)
 * - gazettes.africa -- behind Cloudflare challenge, returns 403
 *
 * Rate limiting: 500ms minimum delay between requests
 * User-Agent header identifies the MCP
 * No auth needed (Government Public Data)
 */

const USER_AGENT = 'Nigeria-Law-MCP/1.0 (https://github.com/Ansvar-Systems/nigeria-law-mcp; hello@ansvar.ai)';
const MIN_DELAY_MS = 500;

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export interface FetchResult {
  status: number;
  body: string;
  contentType: string;
  url: string;
  source: 'plac_html' | 'plac_pdf' | 'nitda' | 'nigerialii' | 'ndpc' | 'lfrn' | 'direct';
}

/**
 * Fetch a URL with rate limiting and proper headers.
 * Retries up to 3 times on 429/5xx errors with exponential backoff.
 * Follows redirects automatically (fetch default).
 */
export async function fetchWithRateLimit(
  url: string,
  source: FetchResult['source'] = 'direct',
  maxRetries = 3,
): Promise<FetchResult> {
  await rateLimit();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html, application/xhtml+xml, application/pdf, */*',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeout);

      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          const backoff = Math.pow(2, attempt + 1) * 1000;
          console.log(`  HTTP ${response.status} for ${url}, retrying in ${backoff}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoff));
          continue;
        }
      }

      const body = await response.text();
      return {
        status: response.status,
        body,
        contentType: response.headers.get('content-type') ?? '',
        url,
        source,
      };
    } catch (error) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`  Network error for ${url}: ${msg}, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

/**
 * Fetch a legislation page from PLAC (placng.org/lawsofnigeria/).
 * PLAC hosts the 2004 Laws of Nigeria as HTML (view2.php) and PDF (laws/*.pdf).
 *
 * @param sn - The sequential number for the act in PLAC's database
 * @returns FetchResult with HTML body containing the act text
 */
export async function fetchPLACHtml(sn: number): Promise<FetchResult> {
  const url = `https://placng.org/lawsofnigeria/view2.php?sn=${sn}`;
  return fetchWithRateLimit(url, 'plac_html');
}

/**
 * Fetch a PDF from PLAC (placng.org/lawsofnigeria/laws/).
 * Note: PDFs are returned as binary data encoded as text -- callers should
 * handle this appropriately (typically by writing to disk and using a PDF parser).
 *
 * @param capRef - The Cap reference (e.g., "E14" for Evidence Act, "C20" for CAMA)
 */
export async function fetchPLACPdf(capRef: string): Promise<FetchResult> {
  const url = `https://placng.org/lawsofnigeria/laws/${capRef}.pdf`;
  return fetchWithRateLimit(url, 'plac_pdf');
}

/**
 * Fetch from the NITDA website (nitda.gov.ng).
 */
export async function fetchNITDA(path: string): Promise<FetchResult> {
  const url = `https://nitda.gov.ng${path}`;
  return fetchWithRateLimit(url, 'nitda');
}

/**
 * Fetch a page from NigeriaLII (nigerialii.org).
 *
 * WARNING (2026-02-19): NigeriaLII legislation section currently has 0 documents.
 * AKN-style URLs (/akn/ng/act/...) return 404. The search is JS-rendered.
 * The Laws.Africa API requires authentication. This function is kept for
 * future use when NigeriaLII adds legislation content.
 */
export async function fetchNigeriaLII(actPath: string): Promise<FetchResult> {
  const url = `https://nigerialii.org${actPath}`;
  return fetchWithRateLimit(url, 'nigerialii');
}

/**
 * Fetch a page from the Laws of the Federation of Nigeria (lfrn.gov.ng).
 *
 * WARNING (2026-02-19): lfrn.gov.ng is completely down (no response).
 * This function is kept for future use when the portal comes back online.
 */
export async function fetchLFRN(path: string): Promise<FetchResult> {
  const url = `https://lfrn.gov.ng${path}`;
  return fetchWithRateLimit(url, 'lfrn');
}

/**
 * Fetch from the Nigeria Data Protection Commission (ndpc.gov.ng).
 *
 * WARNING (2026-02-19): The NDPA 2023 PDF URL has been removed from the site.
 * The NDPC website has guidance documents but not the act text itself.
 */
export async function fetchNDPC(path: string): Promise<FetchResult> {
  const url = `https://ndpc.gov.ng${path}`;
  return fetchWithRateLimit(url, 'ndpc');
}
