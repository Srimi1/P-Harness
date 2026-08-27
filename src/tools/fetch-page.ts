import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { config } from "../config.js";
import type { HarnessTool } from "../registry.js";

// News sites 403 the default undici UA; present a real browser.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const MAX_REDIRECTS = 5;

const turndown = new TurndownService({ headingStyle: "atx" });

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return config.allowedDomains.some((d) => host === d || host.endsWith(`.${d}`));
}

// Anything not provably public routable is refused.
function isPrivateV4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = p;
  if (a === 0 || a === 127) return true; // this-host, loopback
  if (a === 10) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 169 && b === 254) return true; // link-local — cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateV6(ip: string): boolean {
  const host = ip.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (host === "::" || host === "::1") return true;
  const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateV4(mapped[1]); // judge by the embedded v4
  if (/^f[cd]/.test(host)) return true; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(host)) return true; // fe80::/10 link-local
  if (/^ff/.test(host)) return true; // multicast
  return false;
}

function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateV4(ip);
  if (version === 6) return isPrivateV6(ip);
  return true; // unparseable — refuse
}

// The prompt asks the model to stay on the allowed outlets; this enforces it,
// so a prompt-injected page cannot steer a fetch at internal infrastructure.
export async function assertFetchable(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${url.protocol}`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) !== 0) {
    throw new Error(`Refusing to fetch an IP address directly: ${host}`);
  }
  if (!isAllowedHost(host)) {
    throw new Error(
      `Blocked: ${host} is not an allowed outlet ` +
        `(${config.allowedDomains.join(", ")})`,
    );
  }
  // Defence in depth: an allowed name must not resolve into a private range.
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new Error(`Could not resolve host: ${host}`);
  }
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new Error(`Blocked: ${host} resolves to a non-public address`);
    }
  }
}

// Redirects are followed by hand so every hop is re-validated; `redirect:
// "follow"` would let an allowed outlet bounce us anywhere.
async function fetchGuarded(start: URL): Promise<Response> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertFetchable(url);
    const response = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html,*/*" },
      signal: AbortSignal.timeout(15_000),
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`Redirect with no Location header from ${url.href}`);
      }
      url = new URL(location, url);
      continue;
    }
    return response;
  }
  throw new Error(`Too many redirects (>${MAX_REDIRECTS}) from ${start.href}`);
}

export const fetchPage: HarnessTool = {
  name: "fetch_page_content",
  description:
    "Download a web page, strip navigation/ads/scripts, and return the readable " +
    "article text as markdown. Use this to deep-read articles found via search_web. " +
    `Only these outlets can be fetched: ${config.allowedDomains.join(", ")}.`,
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

    const response = await fetchGuarded(url);

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
