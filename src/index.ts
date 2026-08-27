import { config } from "./config.js";
import { runAgent } from "./agent.js";
import * as ui from "./ui.js";

const question = process.argv.slice(2).join(" ").trim();

if (!question) {
  console.error('Usage: npm run research -- "your research question"');
  process.exit(1);
}

ui.banner([
  "Research Harness",
  `  Question:       ${question}`,
  `  Model:          ${config.model}`,
  `  Max iterations: ${config.maxIterations}`,
  "",
]);

const savedPath = await runAgent(question);

if (savedPath) {
  ui.done(`Saved to ${savedPath}`);
  process.exit(0);
} else {
  ui.fail("Run ended without a report.");
  process.exit(1);
}
