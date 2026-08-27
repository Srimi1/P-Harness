import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { config } from "../config.js";
import type { HarnessTool } from "../registry.js";

// News sites 403 the default undici UA; present a real browser.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const turndown = new TurndownService({ headingStyle: "atx" });

export const fetchPage: HarnessTool = {
  name: "fetch_page_content",
  description:
    "Download a web page, strip navigation/ads/scripts, and return the readable " +
    "article text as markdown. Use this to deep-read articles found via search_web.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "Full http(s) URL of the page to read",
      },
    },
    required: ["url"],
  },
  label: (input) => `[Reading] ${String(input.url)}`,
  handler: async (input) => {
    let url: URL;
    try {
      url = new URL(String(input.url ?? ""));
    } catch {
      throw new Error(`Invalid URL: ${String(input.url)}`);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error(`Unsupported protocol: ${url.protocol}`);
    }

    const response = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html,*/*" },
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`Fetch failed (HTTP ${response.status}) for ${url.href}`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      throw new Error(`Not an HTML page (${contentType}): ${url.href}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    $(
      "script, style, nav, header, footer, aside, form, iframe, noscript, svg, " +
        "img, picture, figure, video, audio, button",
    ).remove();
    const container = $("article").html() ?? $("main").html() ?? $("body").html() ?? "";

    let markdown = turndown.turndown(container).replace(/\n{3,}/g, "\n\n").trim();
    if (markdown.length > config.maxPageChars) {
      markdown =
        markdown.slice(0, config.maxPageChars) +
        `\n\n[--- Content truncated at ${config.maxPageChars.toLocaleString("en-US")} characters ---]`;
    }
    if (!markdown) {
      throw new Error(`No readable content extracted from ${url.href}`);
    }

    return `# Fetched: ${url.href}\n\n${markdown}`;
  },
};
