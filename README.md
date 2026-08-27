# 🍌 Research Harness (P-Harness)

<p align="center">
  <img src="docs/media/nano-banana-hero.jpg" alt="Nano Banana AI Research Architect" width="100%" style="border-radius: 12px;"/>
</p>

<p align="center">
  <strong>An autonomous, deterministic CLI research agent built in TypeScript.</strong><br/>
  Deconstructs questions, deep-reads articles from five trusted news outlets, and synthesizes fully-cited Markdown reports.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Language-TypeScript_5-3178C6?logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/LLM-Claude_3.5_/_Opus-D97706?logo=anthropic&logoColor=white" alt="Anthropic"/>
  <img src="https://img.shields.io/badge/Search-Tavily_API-4F46E5" alt="Tavily"/>
  <img src="https://img.shields.io/badge/Scraper-Cheerio_+_Turndown-00DC82" alt="Cheerio"/>
  <img src="https://img.shields.io/badge/Architecture-Hand--Rolled_ReAct-FF0055" alt="ReAct"/>
</p>

---

## 🎬 Visual Tour & Animated GIFs

### 1. The 4-Phase Autonomous Pipeline
The agent executes a deterministic research lifecycle: **Deconstruct** $\rightarrow$ **Explore** $\rightarrow$ **Deep Read** $\rightarrow$ **Synthesize**.

<p align="center">
  <img src="docs/media/pipeline-explainer.gif" alt="Animated 4-Phase Research Pipeline" width="100%" style="border-radius: 8px;"/>
</p>

### 2. Hand-Rolled Tool-Use Loop
Direct, transparent ReAct loop over the Anthropic Messages API with parallel tool batching and forced termination safeguards.

<p align="center">
  <img src="docs/media/tool-loop.gif" alt="Animated ReAct Tool-Use Loop" width="100%" style="border-radius: 8px;"/>
</p>

### 3. Live CLI Terminal Demo
Real-time animated spinners (`ora`), phase narration (`chalk`), and automated file generation.

<p align="center">
  <img src="docs/media/terminal-demo.gif" alt="Animated Terminal Demo" width="100%" style="border-radius: 8px;"/>
</p>

---

## 🚀 Quick Start

### 1. Setup Environment
```bash
cp .env.example .env   # Fill in ANTHROPIC_API_KEY and TAVILY_API_KEY
npm install
```

### 2. Smoke Test (Zero LLM Tokens)
Test search and HTML scraping integrations without spending tokens:
```bash
npm run smoke:tools
```

### 3. Run a Research Query
```bash
npm run research -- "What did the latest UK inflation figures show?"
```

All generated reports are saved with full citations to:
`artifacts/research/<topic-slug>.md`

---

## 🧭 How It Works: The 4 Phases

<p align="center">
  <img src="docs/media/nano-banana-pipeline.jpg" alt="4-Stage Research Pipeline" width="100%" style="border-radius: 10px;"/>
</p>

Defined in `src/prompts.ts`, the agent is governed by strict system prompt rules:

```
Deconstruct ──────> Explore ───────────> Deep Read ──────────────> Synthesize
(3–5 queries)       (search_web)         (fetch_page_content)      (save_research_report)
```

1. **Deconstruct**: Breaks the user's research question into 3–5 targeted news search vectors covering temporal context, entities, and economic/social angles.
2. **Explore (`search_web`)**: Queries the Tavily API restricted strictly to 5 journalistic domains. Returns candidate headlines, URLs, and snippets.
3. **Deep Read (`fetch_page_content`)**:
   - Uses real browser headers to prevent 403 blocks.
   - Cleans HTML via **Cheerio** (strips scripts, navigation, sidebars, headers, and ads).
   - Converts the article body into clean Markdown via **Turndown**.
   - **Rule**: Must read $\ge 3$ distinct sources. Search snippets alone are never cited.
4. **Synthesize (`save_research_report`)**:
   - Compiles Executive Summary, Key Findings, Detailed Breakdown, and Bibliography.
   - Embeds inline `[Publication](URL)` markdown citations for every fact.
   - Writes frontmatter and content to `artifacts/research/<slug>.md`.

---

## ⚙️ Hand-Rolled Tool-Use Loop

<p align="center">
  <img src="docs/media/nano-banana-tool-loop.jpg" alt="Hand-Rolled Tool Execution Loop" width="100%" style="border-radius: 10px;"/>
</p>

Rather than using complex orchestration frameworks, `src/agent.ts` is an explicit, inspectable loop:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User Prompt + History -> client.beta.messages.create()   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Claude evaluates prompt & emits tool_use blocks          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Harness executes tool handlers inside Ora Spinners       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Batches all tool_results into ONE user message turn      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Repeat until save_research_report or MAX_ITERATIONS cap  │
└─────────────────────────────────────────────────────────────┘
```

### Key Engineering Features in `src/agent.ts`:
- **Single User Message Batching**: All parallel `tool_result` blocks are grouped into a single user message (`messages.push({ role: 'user', content: toolResults })`), preserving parallel calling efficiency.
- **Forced Termination Guard**: On iteration `MAX_ITERATIONS - 1`, the loop injects `{ tool_choice: { type: 'tool', name: 'save_research_report' } }`, guaranteeing that a cited report is written to disk before the iteration ceiling is hit.
- **Early Exit**: Immediately returns the file path once `save_research_report` completes successfully, skipping closing pleasantries.

---

## 🛡️ Curated News Whitelist & Security

<p align="center">
  <img src="docs/media/nano-banana-news-sources.jpg" alt="Curated News Whitelist" width="100%" style="border-radius: 10px;"/>
</p>

To eliminate hallucinations, search spam, and clickbait, searches are restricted to five journalistic domains in `src/config.ts`:
- 🇬🇧 **BBC News** (`bbc.com`)
- 📡 **Reuters** (`reuters.com`)
- 📰 **The Guardian** (`theguardian.com`)
- 🎙️ **NPR** (`npr.org`)
- 🌍 **AP News** (`apnews.com`)

### SSRF Guard on `fetch_page_content`

The outlet whitelist is enforced **in code**, not just in the prompt
(`src/tools/fetch-page.ts`). Before any fetch — and again on every redirect hop —
the harness rejects:

- non-`http(s)` schemes (`file:`, `gopher:`, …)
- bare IP addresses
- hosts outside `allowedDomains`, including lookalikes (`evil-bbc.com`, `bbc.com.evil.com`)
- any host resolving into a private, loopback, link-local, or CGNAT range —
  which covers the cloud metadata endpoint `169.254.169.254`

Without this, a prompt-injected article could steer the agent at internal
services or use a fetch as an exfiltration channel. Verify the guard:

```bash
npm run test:security
```

### Leak Prevention & Git Hooks
`ANTHROPIC_API_KEY` and `TAVILY_API_KEY` are read from `.env` at runtime and are never committed.

Run the pre-push credential scan:
```bash
./scripts/pre-push-check.sh
```

Wire it in as a permanent git hook:
```bash
ln -sf ../../scripts/pre-push-check.sh .git/hooks/pre-push
```

---

## 📂 Project Structure

```
P-Harness/
├── docs/
│   └── media/                   # Visual assets, Nano Banana illustrations & GIFs
│       ├── nano-banana-hero.jpg
│       ├── nano-banana-pipeline.jpg
│       ├── nano-banana-tool-loop.jpg
│       ├── nano-banana-news-sources.jpg
│       ├── pipeline-explainer.gif
│       ├── tool-loop.gif
│       └── terminal-demo.gif
├── artifacts/research/          # Generated markdown reports (git-ignored)
├── scripts/
│   ├── pre-push-check.sh        # Leaked credential scanner
│   ├── smoke-tools.ts           # Zero-token integration tester
│   ├── security-test.ts         # SSRF guard regression test
│   └── pre-push-check.sh        # Credential scan before push
├── src/
│   ├── agent.ts                 # Hand-rolled ReAct tool-use loop
│   ├── config.ts                # Environment & domain whitelist
│   ├── index.ts                 # CLI entrypoint & banner
│   ├── prompts.ts               # 4-phase system prompt & rules
│   ├── registry.ts              # HarnessTool interface & registry map
│   ├── ui.ts                    # Chalk & Ora terminal styling
│   └── tools/
│       ├── fetch-page.ts        # Cheerio HTML scraper + Turndown markdown
│       ├── index.ts             # Registry initialization
│       ├── save-report.ts       # Markdown report writer & slugifier
│       └── search-web.ts        # Tavily search API integration
├── .env.example                 # Environment variable template
├── package.json
└── tsconfig.json
```

---

## 🛠️ Adding a New Tool

1. Create a file in `src/tools/` exporting a `HarnessTool`:
   - `name`: Unique tool name
   - `description`: Explains what the tool does for the model
   - `inputSchema`: JSON Schema for parameters
   - `label`: Terminal spinner label string
   - `handler`: Async function returning a string result
2. Register it in `src/tools/index.ts` within the `createRegistry([...])` call.
3. The ReAct loop, schema generation, spinner feedback, and error handling automatically pick it up.
