import type Anthropic from "@anthropic-ai/sdk";

// One tool = one entry: schema for the model, handler for the harness, label
// for the terminal. Register it in src/tools/index.ts and the loop picks it up.
export interface HarnessTool {
  name: string;
  description: string;
  inputSchema: Anthropic.Tool.InputSchema;
  label: (input: Record<string, unknown>) => string;
  handler: (input: Record<string, unknown>) => Promise<string>;
}

export function createRegistry(tools: HarnessTool[]): Map<string, HarnessTool> {
  const registry = new Map<string, HarnessTool>();
  for (const tool of tools) {
    if (registry.has(tool.name)) {
      throw new Error(`Duplicate tool name: ${tool.name}`);
    }
    registry.set(tool.name, tool);
  }
  return registry;
}

export function toAnthropicTools(
  registry: Map<string, HarnessTool>,
): Anthropic.Tool[] {
  return [...registry.values()].map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}
