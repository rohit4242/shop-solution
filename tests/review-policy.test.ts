import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Execute the actual workflow body against mocked GitHub responses.
const yaml = readFileSync(
  new URL("../.github/workflows/cross-group-review.yml", import.meta.url),
  "utf8",
);
const script = yaml
  .split("script: |\n")[1]
  .split("\n")
  .map((line) => line.replace(/^ {12}/, ""))
  .join("\n");
const run = new Function(
  "github",
  "context",
  `return (async () => {${script}})()`,
);
async function check(
  options: {
    groups?: string[];
    stale?: boolean;
    unknown?: boolean;
    dismissed?: boolean;
  } = {},
) {
  const policy = {
    requiredOtherGroups: 2,
    groups: {
      authors: ["author"],
      a: ["alice", "alex"],
      b: ["bob"],
      c: ["carol"],
      d: ["dan"],
      e: ["eve"],
    },
  };
  const reviewers = options.groups ?? ["alice", "bob"];
  const reviews = reviewers.map((login, id) => ({
    id,
    user: { login },
    state: "APPROVED",
    commit_id: options.stale ? "old" : "head",
  }));
  if (options.dismissed)
    reviews.push({
      id: 100,
      user: { login: "alice" },
      state: "DISMISSED",
      commit_id: "head",
    });
  let result = { state: "" };
  const github = {
    rest: {
      pulls: {
        get: async () => ({
          data: {
            number: 1,
            user: { login: options.unknown ? "stranger" : "author" },
            base: { sha: "base" },
            head: { sha: "head" },
          },
        }),
        listReviews: () => {},
      },
      repos: {
        getContent: async () => ({
          data: {
            content: Buffer.from(JSON.stringify(policy)).toString("base64"),
          },
        }),
        createCommitStatus: async (value: { state: string }) => {
          result = value;
        },
      },
    },
    paginate: async () => reviews,
  };
  await run(github, {
    repo: { owner: "class", repo: "shop" },
    payload: { pull_request: { number: 1 } },
  });
  return result.state;
}
describe("cross-group workflow", () => {
  it("requires two distinct other groups", async () => {
    expect(await check()).toBe("success");
    expect(await check({ groups: ["alice", "alex"] })).toBe("failure");
    expect(await check({ groups: ["alice"] })).toBe("failure");
    expect(await check({ groups: ["author", "alice"] })).toBe("failure");
  });
  it("rejects stale, dismissed and unregistered approvals", async () => {
    expect(await check({ stale: true })).toBe("failure");
    expect(await check({ dismissed: true })).toBe("failure");
    expect(await check({ unknown: true })).toBe("failure");
    expect(await check({ groups: ["alice", "outsider"] })).toBe("failure");
  });
});
