import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsDirectory = join(repositoryRoot, "docs");
const requiredPages = [
  "README.md",
  "architecture.md",
  "database.md",
  "editorial-workflow.md",
  "sleeper-sync.md",
  "frontend.md",
  "admin-cms.md",
  "design-system.md",
  "deployment.md",
  "development-workflow.md",
  "decisions.md",
  "roadmap.md",
];

const failures = [];
const markdownFiles = readdirSync(docsDirectory)
  .filter((file) => extname(file) === ".md")
  .sort();

for (const page of requiredPages) {
  if (!existsSync(join(docsDirectory, page))) {
    failures.push(`Missing required handbook page: docs/${page}`);
  }
}

for (const file of markdownFiles) {
  const absolutePath = join(docsDirectory, file);
  const contents = readFileSync(absolutePath, "utf8");
  const lines = contents.split(/\r?\n/);

  if (!contents.match(/^#\s+\S/m)) {
    failures.push(`docs/${file} has no level-one heading.`);
  }

  for (const [index, line] of lines.entries()) {
    if (/^\s*-\s+TODO(?!:)/.test(line)) {
      failures.push(`docs/${file}:${index + 1} uses a TODO list marker without a colon.`);
    }
  }

  const links = contents.matchAll(/\[[^\]]+\]\(([^)]+)\)/g);
  for (const match of links) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, "");
    if (
      !rawTarget ||
      rawTarget.startsWith("#") ||
      /^(https?:|mailto:|tel:)/i.test(rawTarget)
    ) {
      continue;
    }

    const fileTarget = decodeURIComponent(rawTarget.split("#", 1)[0]);
    const resolvedTarget = normalize(resolve(dirname(absolutePath), fileTarget));
    if (!resolvedTarget.startsWith(repositoryRoot) || !existsSync(resolvedTarget)) {
      failures.push(`docs/${file} links to missing local target: ${rawTarget}`);
    }
  }
}

if (failures.length) {
  console.error(`Handbook validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Handbook validation passed: ${requiredPages.length} required pages and ${markdownFiles.length} Markdown files checked.`,
  );
}
