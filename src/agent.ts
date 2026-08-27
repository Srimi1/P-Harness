import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts.js";
import { toAnthropicTools } from "./registry.js";
import { registry } from "./tools/index.js";
import * as ui from "./ui.js";

const SAVED_PATH_PATTERN = /^Report saved to (.+)$/;

// Returns the saved report path, or null if the run ended without one.
export async function runAgent(question: string): Promise<string | null> {
  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const tools = toAnthropicTools(registry);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: buildUserPrompt(question) },
  ];

  try {
    for (let i = 0; i < config.maxIterations; i++) {
      const lastIteration = i === config.maxIterations - 1;

      const response = await client.beta.messages.create({
        model: config.model,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        tools,
        messages,
        // Force the report out before the iteration cap kills the run.
        ...(lastIteration
          ? { tool_choice: { type: "tool" as const, name: "save_research_report" } }
          : {}),
      });

      if (response.stop_reason === "refusal") {
        const details = response.stop_details;
        ui.fail(
          `Request refused${details?.category ? ` (${details.category})` : ""}: ` +
            (details?.explanation ?? "no explanation provided"),
        );
        return null;
      }

      for (const block of response.content) {
        if (block.type === "text") ui.narrate(block.text);
      }

      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      if (response.stop_reason === "max_tokens") {
        ui.warn("Hit max_tokens before finishing — no report was saved.");
        return null;
      }

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
      );
      if (toolUseBlocks.length === 0) {
        // end_turn without calling save_research_report
        ui.warn("Agent finished without saving a report.");
        return null;
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      let savedPath: string | null = null;

      for (const block of toolUseBlocks) {
        const tool = registry.get(block.name);
        const input = block.input as Record<string, unknown>;
        let content: string;
        let isError = false;

        if (!tool) {
          content = `Error: unknown tool "${block.name}"`;
          isError = true;
        } else {
          try {
            content = await ui.runWithSpinner(tool.label(input), () =>
              tool.handler(input),
            );
          } catch (error) {
            content = `Error: ${error instanceof Error ? error.message : String(error)}`;
            isError = true;
          }
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content,
          is_error: isError,
        });

        if (block.name === "save_research_report" && !isError) {
          savedPath = SAVED_PATH_PATTERN.exec(content)?.[1] ?? content;
        }
      }

      // Report on disk — done. Skip the closing-pleasantry API call.
      if (savedPath) return savedPath;

      // All results in ONE user message, or the model stops parallel-calling.
      messages.push({ role: "user", content: toolResults });
    }

    ui.warn(`Hit the ${config.maxIterations}-iteration cap without a report.`);
    return null;
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      ui.fail("Anthropic rejected the API key — check ANTHROPIC_API_KEY in .env.");
    } else if (error instanceof Anthropic.RateLimitError) {
      ui.fail("Rate limited by the Anthropic API — wait a moment and retry.");
    } else if (error instanceof Anthropic.APIError) {
      ui.fail(`Anthropic API error (${error.status}): ${error.message}`);
    } else if (error instanceof Anthropic.APIConnectionError) {
      ui.fail(`Could not reach the Anthropic API: ${error.message}`);
    } else {
      throw error;
    }
    return null;
  }
}
