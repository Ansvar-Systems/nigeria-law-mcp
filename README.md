# Nigeria Law MCP

[![npm](https://img.shields.io/npm/v/@ansvar/nigeria-law-mcp)](https://www.npmjs.com/package/@ansvar/nigeria-law-mcp)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Ansvar-Systems/nigeria-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/nigeria-law-mcp/actions/workflows/ci.yml)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-green)](https://registry.modelcontextprotocol.io/)
[![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/Ansvar-Systems/nigeria-law-mcp)](https://securityscorecards.dev/viewer/?uri=github.com/Ansvar-Systems/nigeria-law-mcp)

A Model Context Protocol (MCP) server providing comprehensive access to Nigerian federal legislation, including data protection (NDPA), cybercrimes, NITDA, companies, and consumer protection law with full-text search.

## Deployment Tier

**SMALL/MEDIUM** -- Likely single tier bundled, possibly dual tier if the full corpus (including state legislation) exceeds npm package size limits.

**Estimated database size:** ~100-250 MB (federal Acts, regulations, and selected state legislation)

## Key Legislation Covered

| Act | Year | Significance |
|-----|------|-------------|
| **Nigeria Data Protection Act (NDPA)** | 2023 | Comprehensive data protection law replacing NDPR 2019; established the Nigeria Data Protection Commission (NDPC) as an independent regulator |
| **Cybercrimes (Prohibition, Prevention, etc.) Act** | 2015 | One of Africa's most comprehensive cybercrime laws, influenced by the Budapest Convention |
| **National Information Technology Development Agency (NITDA) Act** | 2007 | Establishes NITDA for IT development policy and regulation |
| **Companies and Allied Matters Act (CAMA)** | 2020 | Modernised Nigerian company law, replacing CAMA 1990; governs incorporation and regulation of companies |
| **Federal Competition and Consumer Protection Act (FCCPA)** | 2018 | Established the Federal Competition and Consumer Protection Commission (FCCPC) |
| **Evidence Act** | 2011 | Includes electronic evidence provisions; admissibility of computer-generated evidence |
| **Constitution of Nigeria** | 1999 (amended) | Supreme law; Section 37 guarantees the right to private and family life |

## Regulatory Context

- **Data Protection Regulator:** Nigeria Data Protection Commission (NDPC), established as an independent body under the NDPA 2023
- **NDPA 2023** replaced the Nigeria Data Protection Regulation (NDPR) 2019, which was merely a regulation issued by NITDA and lacked the force of an Act of the National Assembly
- **NDPC** has authority to issue regulations, conduct investigations, impose administrative sanctions, and approve cross-border data transfers
- Nigeria is Africa's largest economy (~$450B GDP) and most populous country (~220 million people), making its data protection framework regionally significant
- Nigeria is a member of the African Union and ECOWAS (Economic Community of West African States)
- Nigeria uses a mixed legal system: English common law, customary law, and Islamic (Sharia) law in northern states

## Data Sources

| Source | Authority | Method | Update Frequency | License | Coverage |
|--------|-----------|--------|-----------------|---------|----------|
| [Laws of the Federation of Nigeria (LFRN)](https://lfrn.gov.ng) | Federal Ministry of Justice | HTML/PDF Scrape | On change | Government Public Data | All federal Acts and extant legislation |
| [NigeriaLII](https://nigerialii.org) | AfricanLII | HTML Scrape | On change | Free Access (AfricanLII) | Federal legislation, superior court decisions, subsidiary legislation |
| [NDPC](https://ndpc.gov.ng) | Nigeria Data Protection Commission | HTML Scrape | On change | Government Public Data | NDPA implementing regulations, guidelines, registration requirements |

> Full provenance metadata: [`sources.yml`](./sources.yml)

## Installation

```bash
npm install -g @ansvar/nigeria-law-mcp
```

## Usage

### As stdio MCP server

```bash
nigeria-law-mcp
```

### In Claude Desktop / MCP client configuration

```json
{
  "mcpServers": {
    "nigeria-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/nigeria-law-mcp"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `get_provision` | Retrieve a specific section/article from a Nigerian Act |
| `search_legislation` | Full-text search across all Nigerian legislation |
| `get_provision_eu_basis` | Cross-reference lookup for international framework relationships (GDPR, Budapest Convention, etc.) |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run contract tests
npm run test:contract

# Run all validation
npm run validate

# Build database from sources
npm run build:db

# Start server
npm start
```

## Contract Tests

This MCP includes 12 golden contract tests covering:
- 3 article retrieval tests (NDPA 2023, Cybercrimes Act, CAMA 2020)
- 3 search tests (personal data, cybercrime, consumer protection)
- 2 citation roundtrip tests (official URL patterns)
- 2 cross-reference tests (GDPR relationship, Budapest Convention)
- 2 negative tests (non-existent Act, malformed section)

Run with: `npm run test:contract`

## Security

See [SECURITY.md](./SECURITY.md) for vulnerability disclosure policy.

Report data errors: [Open an issue](https://github.com/Ansvar-Systems/nigeria-law-mcp/issues/new?template=data-error.md)

## License

Apache-2.0 -- see [LICENSE](./LICENSE)

---

Built by [Ansvar Systems](https://ansvar.eu) -- Cybersecurity compliance through AI-powered analysis.
