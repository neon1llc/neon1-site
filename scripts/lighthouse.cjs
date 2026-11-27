// scripts/lighthouse.cjs - Run repeatable local Lighthouse audits against a site URL.

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const BUDGET_PATH = path.join(__dirname, "lighthouse-budget.json");
const LIGHTHOUSE = "lighthouse@13.6.0";
const METRIC_KEYS = [
  "first-contentful-paint",
  "largest-contentful-paint",
  "cumulative-layout-shift",
  "total-blocking-time",
];

// Read the small CLI surface so the Makefile can select a URL, profile, run count, and evidence folder.
function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
    args[key.slice(2)] = value;
    index += 1;
  }
  return args;
}

// Keep the median deterministic for an odd number of complete runs.
function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

// Read category scores and lab metrics from a Lighthouse JSON report.
function readResult(reportPath) {
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  return {
    categories: Object.fromEntries(
      ["performance", "accessibility", "best-practices", "seo"].map((key) => [
        key,
        report.categories[key]?.score ?? null,
      ]),
    ),
    metrics: Object.fromEntries(
      METRIC_KEYS.map((key) => [key, report.audits[key]?.numericValue ?? null]),
    ),
    lighthouseVersion: report.lighthouseVersion,
    userAgent: report.environment?.hostUserAgent ?? null,
  };
}

// Run Lighthouse in its default mobile mode or its desktop preset and save the untouched report.
function runAudit(url, profile, reportPath) {
  const args = [
    "--yes",
    LIGHTHOUSE,
    url,
    "--output=json",
    `--output-path=${reportPath}`,
    "--quiet",
    "--chrome-flags=--headless",
  ];
  if (profile === "desktop") args.push("--preset=desktop");
  if (process.env.CHROME_PATH) args.push(`--chrome-path=${process.env.CHROME_PATH}`);

  const result = spawnSync("npx", args, { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Lighthouse exited with status ${result.status}`);
}

// Apply the checked-in limits to the median of the repeated reports, as Lighthouse CI assertions do.
function checkBudget(profile, results, budget) {
  const assertions = budget.profiles[profile].assertions;
  const medians = {
    categories: Object.fromEntries(
      ["performance"].map((key) => [
        key,
        median(results.map((result) => result.categories[key])),
      ]),
    ),
    metrics: Object.fromEntries(
      Object.keys(assertions)
        .filter((key) => key !== "categories:performance")
        .map((key) => [key, median(results.map((result) => result.metrics[key]))]),
    ),
  };
  const failures = [];
  const warnings = [];
  for (const [key, [level, bounds]] of Object.entries(assertions)) {
    const value = key === "categories:performance"
      ? medians.categories.performance
      : medians.metrics[key];
    const failed = bounds.minScore !== undefined
      ? value < bounds.minScore
      : value > bounds.maxNumericValue;
    if (!failed) continue;
    const message = `${key} ${value} ${bounds.minScore !== undefined ? "<" : ">"} ${bounds.minScore ?? bounds.maxNumericValue}`;
    (level === "error" ? failures : warnings).push(message);
  }
  return { medians, failures, warnings };
}

// Audit each configured page serially to avoid distorting Lighthouse's local CPU and network measurements.
function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args.url;
  const outDir = args.out;
  const profiles = (args.profiles ?? "mobile,desktop").split(",");
  const runs = Number(args.runs ?? 5);
  if (!baseUrl || !outDir) throw new Error("Usage: node scripts/lighthouse.cjs --url URL --out DIR [--profiles mobile,desktop] [--runs 5]");
  if (!Number.isInteger(runs) || runs < 1) throw new Error("--runs must be a positive integer");
  if (profiles.some((profile) => !["mobile", "desktop"].includes(profile))) {
    throw new Error("--profiles accepts mobile,desktop");
  }

  const budget = JSON.parse(fs.readFileSync(BUDGET_PATH, "utf8"));
  const output = path.resolve(outDir);
  fs.mkdirSync(output, { recursive: true });
  const pages = [];
  let failed = false;

  for (const page of budget.pages) {
    for (const profile of profiles) {
      const results = [];
      for (let run = 1; run <= runs; run += 1) {
        const pageDir = path.join(output, profile, page.name);
        fs.mkdirSync(pageDir, { recursive: true });
        const reportPath = path.join(pageDir, `run-${String(run).padStart(2, "0")}.json`);
        console.log(`[${profile}] ${page.name} run ${run}/${runs}: ${new URL(page.path, baseUrl).href}`);
        runAudit(new URL(page.path, baseUrl).href, profile, reportPath);
        results.push(readResult(reportPath));
      }
      const check = checkBudget(profile, results, budget);
      failed ||= check.failures.length > 0;
      pages.push({
        name: page.name,
        url: new URL(page.path, baseUrl).href,
        profile,
        runs: results,
        medians: check.medians,
        failures: check.failures,
        warnings: check.warnings,
      });
      console.log(
        `[${profile}] ${page.name} median: ${JSON.stringify(check.medians)}` +
          (check.failures.length ? ` FAIL ${check.failures.join("; ")}` : " PASS") +
          (check.warnings.length ? ` WARN ${check.warnings.join("; ")}` : ""),
      );
    }
  }

  const summary = {
    measuredAt: new Date().toISOString(),
    baseUrl,
    lighthouseVersion: pages[0]?.runs[0]?.lighthouseVersion ?? LIGHTHOUSE,
    runsPerPageAndProfile: runs,
    pages,
    pass: !failed,
  };
  const summaryPath = path.join(output, "summary.json");
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`Summary: ${summaryPath}`);
  if (failed) process.exitCode = 1;
}

main();
