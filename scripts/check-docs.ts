import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const featureRoot = "src/features";
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const archives = new Set(["evidence", "exercises"]);
const docsRoots = ["docs", featureRoot, "prisma"];
const rootDocs = ["README.md", "AGENTS.md", "CLAUDE.md", "DESIGN.md"];
type ChangedFile = { path: string; deleted?: boolean };

function markdownFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && !archives.has(entry.name)) {
      files.push(...markdownFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(path);
    }
  }
  return files;
}

export function relativeLinks(markdown: string) {
  const links: { target: string; line: number }[] = [];
  let fence = "";
  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    const marker = line.match(/^ {0,3}(\x60{3,}|~{3,})(.*)$/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (
        marker[1][0] === fence[0] &&
        marker[1].length >= fence.length &&
        !marker[2].trim()
      ) {
        fence = "";
      }
      continue;
    }
    if (fence) continue;
    const prose = line.replace(/(\x60+).*?\1/g, "");
    for (const link of prose.matchAll(
      /\[[^\]\n]*\]\(\s*(?:<([^>\n]+)>|((?:[^()\s]|\([^()\s]*\))+))/g,
    )) {
      const target = (link[1] ?? link[2]).trim();
      if (!/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(target)) {
        links.push({ target, line: index + 1 });
      }
    }
  }
  return links;
}

function featureForPublicFile(path: string, teams: ReadonlySet<string>) {
  const parts = path.split("/");
  const [src, group, area, apiVersion, resource] = parts;
  if (src === "src" && group === "features" && teams.has(area)) {
    const file = parts.slice(3).join("/");
    if (
      file === "index.ts" ||
      file === "server/index.ts" ||
      /(?:^|\/)openapi\.(?:ya?ml|json)$/.test(file)
    ) {
      return area;
    }
  }
  if (
    src === "src" &&
    group === "app" &&
    area === "api" &&
    apiVersion === "v1" &&
    parts.at(-1) === "route.ts"
  ) {
    const team = ["search", "recommendations"].includes(resource)
      ? "search-recommendations"
      : resource;
    if (teams.has(team)) return team;
  }
  if (
    src === "docs" &&
    teams.has(group) &&
    /(?:^|\/)openapi\.(?:ya?ml|json)$/.test(path)
  ) {
    return group;
  }
}

export function teamsMissingDocs(
  changes: ChangedFile[],
  teams: ReadonlySet<string>,
) {
  const publicTeams = new Set(
    changes.flatMap(({ path }) => {
      const team = featureForPublicFile(path, teams);
      return team ? [team] : [];
    }),
  );
  return [...publicTeams]
    .filter(
      (team) =>
        !changes.some(
          ({ path, deleted }) =>
            !deleted &&
            path.endsWith(".md") &&
            !path.split("/").some((segment) => archives.has(segment)) &&
            (path.startsWith(featureRoot + "/" + team + "/") ||
              path.startsWith("docs/" + team + "/")),
        ),
    )
    .sort();
}

function checkDocs() {
  const teams = new Set(
    readdirSync(join(repositoryRoot, featureRoot), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );
  const errors: string[] = [];
  for (const team of teams) {
    const readme = featureRoot + "/" + team + "/README.md";
    const path = join(repositoryRoot, readme);
    if (!existsSync(path) || !readFileSync(path, "utf8").trim()) {
      errors.push(readme + " is missing or empty.");
    }
  }

  const docs = [
    ...rootDocs.map((name) => join(repositoryRoot, name)),
    ...docsRoots.flatMap((directory) =>
      markdownFiles(join(repositoryRoot, directory)),
    ),
  ];
  const product = join(repositoryRoot, "PRODUCT.md");
  if (existsSync(product)) docs.push(product);
  for (const doc of docs) {
    for (const { target, line } of relativeLinks(readFileSync(doc, "utf8"))) {
      const location = relative(repositoryRoot, doc) + ":" + line;
      const path = target.split(/[?#]/, 1)[0];
      let decoded: string;
      try {
        decoded = decodeURIComponent(path);
      } catch {
        errors.push(location + " has an invalid link target: " + target);
        continue;
      }
      const destination = resolve(dirname(doc), decoded);
      const localPath = relative(repositoryRoot, destination);
      if (
        localPath === ".." ||
        localPath.startsWith(".." + sep) ||
        !existsSync(destination)
      ) {
        errors.push(location + " has an unresolved local link: " + target);
      }
    }
  }

  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
    return;
  }
  console.log(
    "Checked " +
      teams.size +
      " feature READMEs and " +
      docs.length +
      " Markdown files.",
  );

  const base = process.env.DOCS_BASE_SHA;
  if (!base) return;
  if (!/^[a-f0-9]{40}$/i.test(base)) {
    throw new Error("DOCS_BASE_SHA must be a full Git commit SHA.");
  }
  const records = execFileSync(
    "git",
    ["diff", "--name-status", "--no-renames", "-z", base, "HEAD", "--"],
    { cwd: repositoryRoot, encoding: "utf8" },
  ).split("\0");
  const changes: ChangedFile[] = [];
  for (let index = 0; index + 1 < records.length; index += 2) {
    changes.push({ path: records[index + 1], deleted: records[index] === "D" });
  }
  for (const team of teamsMissingDocs(changes, teams)) {
    const message =
      "Public interface changed for " +
      team +
      ". Update or confirm its feature documentation in the PR.";
    console.warn(
      process.env.GITHUB_ACTIONS === "true" ? "::warning::" + message : message,
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  checkDocs();
}
