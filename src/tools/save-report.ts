import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { HarnessTool } from "../registry.js";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "") || "report";
}

export const saveReport: HarnessTool = {
  name: "save_research_report",
  description:
    "Save the final markdown research report to disk. Call this exactly once, " +
    "after fetching at least 3 sources, as the last step of your research.",
  inputSchema: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "Short report title; used to name the file",
      },
      content: {
        type: "string",
        description:
          "Full markdown report body with sections: Executive Summary, " +
          "Key Findings, Detailed Breakdown, Bibliography",
      },
      sources: {
        type: "array",
        items: { type: "string" },
        description: "URLs of every source actually fetched and cited",
      },
    },
    required: ["topic", "content", "sources"],
  },
  label: (input) => `[Synthesizing] "${String(input.topic)}"`,
  handler: async (input) => {
    const topic = String(input.topic ?? "").trim();
    const content = String(input.content ?? "").trim();
    const sources = Array.isArray(input.sources)
      ? input.sources.map(String)
      : [];
    if (!topic || !content) {
      throw new Error("save_research_report requires topic and content");
    }

    const dir = path.resolve("artifacts", "research");
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${slugify(topic)}.md`);

    const frontmatter = [
      "---",
      `title: ${JSON.stringify(topic)}`,
      `date: ${new Date().toISOString()}`,
      "generated_by: research-harness",
      "---",
    ].join("\n");

    const sourceList =
      sources.length > 0
        ? "\n\n## Sources\n\n" +
          sources.map((url, i) => `${i + 1}. <${url}>`).join("\n")
        : "";

    await writeFile(filePath, `${frontmatter}\n\n${content}${sourceList}\n`, "utf8");
    return `Report saved to ${filePath}`;
  },
};
