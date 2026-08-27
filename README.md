# Research Harness

A CLI research agent. Give it a question; it plans searches, pulls articles from
five news outlets, deep-reads them, and writes a cited markdown digest to
`artifacts/research/`.

Outlets: BBC, Reuters, The Guardian, NPR, AP News (enforced via Tavily's
`include_domains` — edit `allowedDomains` in `src/config.ts` to change them).

## Setup

```bash
cp .env.example .env   # then fill in ANTHROPIC_API_KEY and TAVILY_API_KEY
npm install
```

## Run

```bash
npm run research -- "What did the latest UK inflation figures show?"
```

Smoke-test the tools without spending Anthropic tokens:

```bash
npm run smoke:tools
```

## How it works

The agent follows a strict 4-phase workflow, enforced by the system prompt in
`src/prompts.ts`:

```
Deconstruct ──> Explore ──────> Deep Read ──────────> Synthesize
(3–5 queries)   (search_web)    (fetch_page_content)  (save_research_report)
```

`src/agent.ts` is a hand-rolled tool-use loop over the Anthropic Messages API:
send prompt + tool schemas → execute any `tool_use` blocks → return
`tool_result`s → repeat until the model saves the report. The loop caps
iterations (`MAX_ITERATIONS`) and on the final iteration forces a
`save_research_report` call so a long run still produces an artifact.

Rules the prompt enforces: read at least 3 sources with `fetch_page_content`
before concluding, cite every major fact inline with a `[Publication](URL)`
link to a fetched page, quote key data points verbatim, and structure the
report as Executive Summary / Key Findings / Detailed Breakdown / Bibliography.

## Adding a tool

Create a file in `src/tools/` exporting a `HarnessTool` (name, description,
JSON Schema, a `label` for the spinner, and an async `handler` returning a
string), then add it to the `createRegistry([...])` call in
`src/tools/index.ts`. The loop, schema wiring, spinner feedback, and error
handling all pick it up automatically.

## Note on the loop

The manual loop in `src/agent.ts` exists to make the request → `tool_use` →
`tool_result` cycle visible. Once that clicks, the whole thing collapses into
the SDK's `client.beta.messages.toolRunner(...)` helper — same behavior, no
hand-written loop.
