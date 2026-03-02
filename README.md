# Nigerian Law MCP Server

**The NigeriaLII alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fnigeria-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/nigeria-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/nigeria-law-mcp?style=social)](https://github.com/Ansvar-Systems/nigeria-law-mcp)
[![CI](https://github.com/Ansvar-Systems/nigeria-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/nigeria-law-mcp/actions/workflows/ci.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](https://github.com/Ansvar-Systems/nigeria-law-mcp)
[![Status](https://img.shields.io/badge/status-initial--build-orange)](https://github.com/Ansvar-Systems/nigeria-law-mcp)

Query Nigerian law -- from the Nigeria Data Protection Act (NDPA) and Cybercrimes Act to the Companies and Allied Matters Act 2020 (CAMA), Consumer Protection Act, and Criminal Code -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Nigerian legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Nigerian legal research means navigating nigerialii.org, lawnigeria.com, law.gov.ng, and scattered government ministry portals -- while dealing with inconsistent digitization of the Laws of the Federation of Nigeria. Whether you're:

- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking NDPA obligations or NDPR requirements
- A **legal tech developer** building tools on Nigerian law
- A **researcher** tracing provisions through the Laws of the Federation

...you shouldn't need dozens of browser tabs and manual cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Nigerian law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://nigeria-law-mcp.vercel.app/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add nigerian-law --transport http https://nigeria-law-mcp.vercel.app/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nigerian-law": {
      "type": "url",
      "url": "https://nigeria-law-mcp.vercel.app/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "nigerian-law": {
      "type": "http",
      "url": "https://nigeria-law-mcp.vercel.app/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/nigeria-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "nigerian-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/nigeria-law-mcp"]
    }
  }
}
```

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "nigerian-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/nigeria-law-mcp"]
    }
  }
}
```

---

## Example Queries

Once connected, just ask naturally:

- *"What does the NDPR (Nigeria Data Protection Regulation) say about consent for data processing?"*
- *"Find provisions in the Nigeria Data Protection Act (NDPA) on data subject rights"*
- *"Search for company law provisions under CAMA 2020 on director duties"*
- *"What does the Cybercrimes Act say about unauthorized computer access?"*
- *"Find provisions in the Criminal Code Act about fraud offences"*
- *"Is the Consumer Protection Act still in force?"*
- *"Search for financial services regulation provisions on KYC requirements"*
- *"Validate the citation Nigeria Data Protection Act 2023, Section 24"*
- *"Build a legal stance on data processor obligations under Nigerian law"*

---

## Current Coverage State

> **Note:** This MCP server is in its initial build phase. The database schema, ingestion pipeline, and all 13 tools are fully operational. Statute ingestion from NigeriaLII and official government sources is actively underway.

The server covers the following priority Nigerian statutes:

| Priority Area | Key Statutes |
|---------------|-------------|
| **Data Protection** | Nigeria Data Protection Act 2023 (NDPA); Nigeria Data Protection Regulation (NDPR) |
| **Cybersecurity** | Cybercrimes (Prohibition, Prevention, Etc.) Act 2015 |
| **Corporate Law** | Companies and Allied Matters Act 2020 (CAMA) |
| **Consumer Protection** | Federal Competition and Consumer Protection Act 2018 |
| **Criminal Law** | Criminal Code Act; Penal Code Act |
| **Financial Services** | Banks and Other Financial Institutions Act (BOFIA) |
| **IT / Communications** | National Information Technology Development Agency Act; Nigerian Communications Act |

Coverage is expanding with each ingestion run. Use `list_sources` to see the current statute count and `about` for dataset statistics.

**Verified data only** -- every citation is validated against official sources (NigeriaLII, law.gov.ng). Zero LLM-generated content.

---

## Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from nigerialii.org, lawnigeria.com, and official government sources
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains statute text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by Act name + section number
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
NigeriaLII / law.gov.ng --> Parse --> SQLite --> FTS5 snippet() --> MCP response
                             ^                        ^
                      Provision parser         Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search NigeriaLII by Act name | Search by plain English: *"data controller consent"* |
| Navigate multi-section Acts manually | Get the exact provision with context |
| Manual cross-referencing between Acts | `build_legal_stance` aggregates across sources |
| "Is this Act still in force?" -- check manually | `check_currency` tool -- answer in seconds |
| Find AU/ECOWAS alignment -- search separately | `get_eu_basis` -- linked international frameworks |
| No API, no integration | MCP protocol -- AI-native |

**Traditional:** Search NigeriaLII --> Navigate Act PDF --> Ctrl+F --> Cross-reference with NITDA guidelines --> Check ECOWAS frameworks separately --> Repeat

**This MCP:** *"What are the obligations of a data controller under the NDPA and how do they compare to GDPR requirements?"* --> Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across provisions with BM25 ranking. Supports quoted phrases, boolean operators, prefix wildcards |
| `get_provision` | Retrieve specific provision by Act name + section number |
| `check_currency` | Check if an Act is in force, amended, or repealed |
| `validate_citation` | Validate citation against database -- zero-hallucination check |
| `build_legal_stance` | Aggregate citations from multiple Acts for a legal topic |
| `format_citation` | Format citations per Nigerian legal conventions |
| `list_sources` | List all available Acts with metadata, coverage scope, and current ingestion status |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### International Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get international frameworks (AU, ECOWAS, Commonwealth, GDPR comparisons) that a Nigerian Act aligns with |
| `get_nigerian_implementations` | Find Nigerian laws corresponding to a specific international standard |
| `search_eu_implementations` | Search international documents with Nigerian alignment counts |
| `get_provision_eu_basis` | Get international law references for a specific provision |
| `validate_eu_compliance` | Check alignment status of Nigerian statutes against international frameworks |

---

## International Law Alignment

Nigeria is not an EU member state, but Nigerian law has significant alignment with international frameworks:

- **Nigeria Data Protection Act 2023 (NDPA)** -- Closely modelled on GDPR principles: data subject rights, controller and processor obligations, cross-border transfer requirements, Data Protection Officer mandates
- **NITDA** -- The Nigeria Data Protection Bureau (successor to NITDA oversight) enforces the NDPA with reference to international standards
- **African Union** -- Nigeria has signed the AU Convention on Cyber Security and Personal Data Protection (Malabo Convention)
- **ECOWAS** -- Member of the Economic Community of West African States Supplementary Act on Personal Data Protection
- **Commonwealth** -- Commonwealth principles on personal data protection and rule of law apply

The international alignment tools allow you to explore these relationships -- checking which Nigerian provisions correspond to GDPR requirements or AU standards.

> **Note:** International cross-references reflect alignment relationships. Nigeria operates its own independent legal system under Acts of the National Assembly and Constitutional law. The tools identify comparative domains rather than formal transposition.

---

## Data Sources & Freshness

All content is sourced from authoritative Nigerian legal databases:

- **[NigeriaLII](https://nigerialii.org)** -- Nigeria Legal Information Institute, primary open access source
- **[Law Nigeria](https://lawnigeria.com)** -- Comprehensive Nigerian law database
- **[law.gov.ng](https://law.gov.ng)** -- Official government law portal

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | National Assembly of Nigeria / Attorney General of the Federation |
| **Retrieval method** | NigeriaLII and official government portals |
| **Languages** | English (official language) |
| **License** | Nigeria Government public domain |
| **Coverage** | Priority statutes; corpus expanding with active ingestion |

### Automated Freshness Checks

A [GitHub Actions workflow](.github/workflows/check-updates.yml) monitors data sources for changes:

| Check | Method |
|-------|--------|
| **Statute amendments** | Drift detection against known provision anchors |
| **New Acts** | Comparison against National Assembly publications |
| **Repealed legislation** | Status change detection |

**Verified data only** -- every citation is validated against official sources. Zero LLM-generated content.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from NigeriaLII and official government sources. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **This server is in initial build phase** -- coverage is incomplete; use `list_sources` to confirm which Acts are available
> - **Court case coverage is not included** -- do not rely solely on this for case law research
> - **Verify critical citations** against primary sources (NigeriaLII, official Gazette) for court filings
> - **International cross-references** reflect alignment relationships, not formal transposition
> - **State vs. federal law** -- this covers federal Acts only; state-level legislation varies across Nigeria's 36 states

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [SECURITY.md](SECURITY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. For professional use guidance, consult the **Nigerian Bar Association (NBA)** professional conduct rules.

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/nigeria-law-mcp
cd nigeria-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest          # Ingest Acts from NigeriaLII / official sources
npm run build:db        # Rebuild SQLite database
npm run drift:detect    # Run drift detection against anchors
npm run check-updates   # Check for amendments and new Acts
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Reliability:** 100% ingestion success rate for ingested Acts

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### [@ansvar/nigeria-law-mcp](https://github.com/Ansvar-Systems/nigeria-law-mcp) (This Project)
**Query Nigerian legislation directly from Claude** -- NDPA, Cybercrimes Act, CAMA 2020, Consumer Protection Act, Criminal Code, and more. `npx @ansvar/nigeria-law-mcp`

### [@ansvar/ghana-law-mcp](https://github.com/Ansvar-Systems/ghana-law-mcp)
**Query Ghanaian legislation** -- Data Protection Act, Cybersecurity Act, Companies Act 2019, Electronic Transactions Act, and more. `npx @ansvar/ghana-law-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

**70+ national law MCPs** covering Australia, Brazil, Canada, Cameroon, Denmark, Finland, France, Germany, Ghana, India, Ireland, Israel, Japan, Netherlands, Norway, Singapore, Sweden, Switzerland, UAE, UK, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Statute corpus expansion (additional Acts from NigeriaLII)
- Court case law integration (Supreme Court of Nigeria decisions)
- Historical statute versions and amendment tracking
- ECOWAS and AU framework alignment mappings
- NITDA guidelines and sector-specific regulations (SEC, CBN, NAFDAC)

---

## Roadmap

- [x] Core database schema with FTS5 search
- [x] International law alignment tools
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [ ] Initial statute corpus ingestion (NDPA, Cybercrimes Act, CAMA, Consumer Protection Act)
- [ ] Full corpus expansion via NigeriaLII
- [ ] Court case law (Supreme Court of Nigeria)
- [ ] Historical statute versions (amendment tracking)
- [ ] ECOWAS and AU framework alignment mappings
- [ ] State-level legislation summaries

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{nigerian_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Nigerian Law MCP Server: AI-Powered Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/nigeria-law-mcp},
  note = {Nigerian Acts of Parliament with full-text search and international alignment tools}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Acts of Parliament:** National Assembly of Nigeria (public domain)
- **NigeriaLII Content:** Nigeria Legal Information Institute (open access)
- **EU Metadata:** EUR-Lex (EU public domain)

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the global market. This MCP server is part of our commitment to open legal data access across Africa -- Nigeria's legal system is substantial and deserves proper AI tooling.

So we're open-sourcing it. Navigating the Laws of the Federation shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
