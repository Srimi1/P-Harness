// Exercises the external integrations directly — zero Anthropic tokens.
// Usage: npm run smoke:tools
import { searchWeb } from "../src/tools/search-web.js";
import { fetchPage } from "../src/tools/fetch-page.js";

console.log("=== search_web ===");
const searchResult = await searchWeb.handler({
  query: "latest UK inflation figures",
});
console.log(searchResult);

console.log("\n=== fetch_page_content (BBC) ===");
const pageResult = await fetchPage.handler({ url: "https://www.bbc.com/news" });
console.log(pageResult.slice(0, 1500));
console.log(`\n[fetched ${pageResult.length} chars total]`);

console.log("\n=== fetch_page_content (garbage URL, must throw cleanly) ===");
try {
  await fetchPage.handler({ url: "https://does-not-exist.invalid/x" });
  console.error("ERROR: garbage URL did not throw");
  process.exit(1);
} catch (error) {
  console.log(`Threw as expected: ${error instanceof Error ? error.message : error}`);
}

console.log("\nSmoke test passed.");
