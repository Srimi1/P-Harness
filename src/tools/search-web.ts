import { config } from "../config.js";
import type { HarnessTool } from "../registry.js";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

export const searchWeb: HarnessTool = {
  name: "search_web",
  description:
    "Search recent news coverage via Tavily, restricted to these outlets: " +
    `${config.allowedDomains.join(", ")}. ` +
    "Returns up to 5 results with title, URL, and snippet. " +
    "Snippets are leads only — use fetch_page_content to actually read an article.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "A targeted news search query",
      },
    },
    required: ["query"],
  },
  label: (input) => `[Searching] "${String(input.query)}"`,
  handler: async (input) => {
    const query = String(input.query ?? "").trim();
    if (!query) throw new Error("search_web requires a non-empty query");

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.tavilyApiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: config.maxResults,
        include_domains: config.allowedDomains,
        search_depth: "basic",
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const body = (await response.text()).slice(0, 300);
      throw new Error(`Tavily search failed (HTTP ${response.status}): ${body}`);
    }

    const data = (await response.json()) as { results?: TavilyResult[] };
    const results = data.results ?? [];
    if (results.length === 0) {
      return "No results — try rephrasing the query.";
    }

    return results
      .map(
        (r, i) =>
          `${i + 1}. ${r.title}\n   URL: ${r.url}\n   Snippet: ${r.content}`,
      )
      .join("\n\n");
  },
};
