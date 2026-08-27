import "dotenv/config";
import chalk from "chalk";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(chalk.red(`Missing required environment variable: ${name}`));
    console.error(chalk.red(`Copy .env.example to .env and fill in ${name}.`));
    process.exit(1);
  }
  return value;
}

function parseMaxIterations(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(parsed)) return 15;
  return Math.max(5, parsed);
}

export const config = Object.freeze({
  anthropicApiKey: requireEnv("ANTHROPIC_API_KEY"),
  tavilyApiKey: requireEnv("TAVILY_API_KEY"),
  model: process.env.MODEL?.trim() || "claude-opus-5",
  maxIterations: parseMaxIterations(process.env.MAX_ITERATIONS),
  maxPageChars: 18_000,
  maxResults: 5,
  allowedDomains: [
    "bbc.com",
    "reuters.com",
    "theguardian.com",
    "npr.org",
    "apnews.com",
  ] as readonly string[],
});
