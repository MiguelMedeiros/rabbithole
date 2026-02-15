import chalk from "chalk";
import ora from "ora";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runAudit } from "../services/audit.js";
import { getOutdated } from "../services/outdated.js";
import { getMultiplePackageMetadata } from "../services/registry.js";
import { displayFullReport } from "../utils/display.js";
import type { ScanReport, RegistryMetadata } from "../utils/types.js";

function getAllDependencyNames(): string[] {
  try {
    const pkgPath = resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const deps = Object.keys(pkg.dependencies ?? {});
    const devDeps = Object.keys(pkg.devDependencies ?? {});
    return [...deps, ...devDeps];
  } catch {
    return [];
  }
}

export async function scanCommand(): Promise<void> {
  // Check if package.json exists
  try {
    readFileSync(resolve(process.cwd(), "package.json"), "utf-8");
  } catch {
    console.log(chalk.red("\n  No package.json found in the current directory.\n"));
    process.exit(1);
  }

  const spinner = ora({
    text: "Scanning dependencies...",
    prefixText: " ",
  }).start();

  try {
    // Run audit and outdated in parallel
    spinner.text = "Running npm audit...";
    const auditPromise = runAudit();

    spinner.text = "Checking for outdated packages...";
    const outdatedPromise = getOutdated();

    const [audit, outdated] = await Promise.all([auditPromise, outdatedPromise]);

    // Fetch registry metadata for all dependencies
    spinner.text = "Fetching package metadata from registry...";
    const allDeps = getAllDependencyNames();
    const metadata = await getMultiplePackageMetadata(allDeps);

    // Separate deprecated and stale
    const deprecated: RegistryMetadata[] = metadata.filter((m) => m.deprecated !== false);
    const stale: RegistryMetadata[] = metadata.filter(
      (m) => m.isStale && m.deprecated === false
    );

    spinner.stop();

    const report: ScanReport = {
      audit,
      outdated,
      deprecated,
      stale,
    };

    displayFullReport(report);
  } catch (err) {
    spinner.fail("Scan failed");
    console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
    process.exit(1);
  }
}
