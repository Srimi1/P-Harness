import chalk from "chalk";
import ora from "ora";

// The loop owns presentation; tools stay pure input -> Promise<string>.
export async function runWithSpinner<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  const spinner = ora(label).start();
  try {
    const result = await fn();
    spinner.succeed(label);
    return result;
  } catch (error) {
    spinner.fail(`${label} — ${error instanceof Error ? error.message : error}`);
    throw error;
  }
}

export function narrate(text: string): void {
  const trimmed = text.trim();
  if (trimmed) console.log(chalk.dim(trimmed));
}

export function banner(lines: string[]): void {
  console.log(chalk.cyan(lines.join("\n")));
}

export function done(message: string): void {
  console.log(chalk.green(`[Done] ${message}`));
}

export function warn(message: string): void {
  console.log(chalk.yellow(message));
}

export function fail(message: string): void {
  console.error(chalk.red(message));
}
