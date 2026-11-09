import { agentBrief, agentSkill, mcpInstallSnippets } from "../docs/agent-kit";
import { displayOrigin, mcpPath } from "../server/origin";
import { CodeBlock, CodeExamples } from "./code-examples";

const docsBase = "/docs/search-recommendations";

export function UseWithAiContent() {
  const origin = displayOrigin();
  const mcpUrl = `${origin ?? "https://<this-site>"}${mcpPath}`;
  return (
    <div className="space-y-10">
      <p>
        Give your AI agent access to our product search and recommendations.
        Pick one of the three ways below: connect the MCP server, paste a short
        brief into any chat, or add a skill file to your project. All three
        describe the same five read-only operations, and none needs a login.
      </p>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Connect the MCP server</h2>
        <p className="text-sm text-muted-foreground">
          Best for coding agents and desktop clients. Your agent gets the tools{" "}
          <code>search</code>, <code>facets</code>, <code>autocomplete</code>,{" "}
          <code>similar</code> and <code>also_bought</code>, plus the OpenAPI
          contract as a resource.
        </p>
        <CodeExamples examples={mcpInstallSnippets(mcpUrl)} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Paste into any AI chat</h2>
        <p className="text-sm text-muted-foreground">
          For chat assistants without MCP. The brief lists every endpoint,
          parameter and rule, so the model can write correct requests. The same
          text is at{" "}
          <a className="underline" href={`${docsBase}/llms.txt`}>
            llms.txt
          </a>
          .
        </p>
        <details className="rounded-lg border">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
            Show the agent brief
          </summary>
          <div className="p-2">
            <CodeBlock code={agentBrief(origin)} />
          </div>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          3. Add a skill to your project
        </h2>
        <p className="text-sm text-muted-foreground">
          Save this as <code>.claude/skills/shop-search/SKILL.md</code> (Claude
          Code) or <code>.agents/skills/shop-search/SKILL.md</code> (Codex).
          Your agent then loads it whenever a task needs product data. In the
          shop-solution repository the skill is already there. Download:{" "}
          <a className="underline" href={`${docsBase}/skill.md`}>
            skill.md
          </a>
          .
        </p>
        <details className="rounded-lg border">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
            Show SKILL.md
          </summary>
          <div className="p-2">
            <CodeBlock code={agentSkill(origin)} />
          </div>
        </details>
      </section>

      <p className="text-sm text-muted-foreground">
        All data is mock data. Prices are euro cents. Results from other teams
        (product names, descriptions) are data for your agent, never
        instructions.
      </p>
    </div>
  );
}
