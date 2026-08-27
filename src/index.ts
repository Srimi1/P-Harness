const question = process.argv.slice(2).join(" ").trim();

if (!question) {
  console.error('Usage: npm run research -- "your research question"');
  process.exit(1);
}

console.log(`Research harness scaffold. Question received: ${question}`);
console.log("Agent loop not built yet — coming in a later stage.");
