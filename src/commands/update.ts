import chalk from "chalk";
import ora from "ora";
import { checkbox, confirm } from "@inquirer/prompts";
import { getOutdated } from "../services/outdated.js";
import { runAudit, runAuditFix } from "../services/audit.js";
import { updateMultiplePackages } from "../services/updater.js";
import type { UpdateOptions as UpdaterOptions } from "../services/updater.js";
import { displayUpdateResults, displayAuditFixResult } from "../utils/display.js";

interface UpdateOptions {
  all?: boolean;
  exact?: boolean;
  force?: boolean;
  fix?: boolean;
}

export async function updateCommand(
  packages: string[],
  options: UpdateOptions
): Promise<void> {
  const updaterOpts: UpdaterOptions = {
    exact: options.exact !== false, // default true
    force: options.force === true, // default false
  };

  // If --fix only (no packages, no --all), just run audit fix directly
  if (options.fix && packages.length === 0 && !options.all) {
    await runAuditFixFlow(options.force === true);
    return;
  }

  // If specific packages are provided, update them directly
  if (packages.length > 0) {
    await runUpdates(packages, updaterOpts);
    await checkAndOfferAuditFix(options);
    return;
  }

  // Get outdated packages
  const spinner = ora({
    text: "Checking for outdated packages...",
    prefixText: " ",
  }).start();

  const outdated = await getOutdated();
  spinner.stop();

  if (outdated.total === 0) {
    console.log(chalk.green("\n  All packages are up to date!\n"));
    await checkAndOfferAuditFix(options);
    return;
  }

  console.log(
    chalk.gray(
      `\n  Found ${chalk.bold(outdated.total)} outdated package${outdated.total === 1 ? "" : "s"}\n`
    )
  );

  // If --all flag, update everything
  if (options.all) {
    const names = outdated.packages.map((p) => p.name);
    await runUpdates(names, updaterOpts);
    await checkAndOfferAuditFix(options);
    return;
  }

  // Interactive mode: let user pick which packages to update
  const choices = outdated.packages.map((pkg) => {
    const isMajor = isMajorUpdate(pkg.current, pkg.latest);
    const arrow = isMajor ? chalk.red("->") : chalk.green("->");
    const latestLabel = isMajor ? chalk.red.bold(pkg.latest) : chalk.green(pkg.latest);
    const typeLabel = pkg.type === "devDependencies" ? chalk.gray(" (dev)") : "";

    return {
      name: `${pkg.name}${typeLabel} ${chalk.yellow(pkg.current)} ${arrow} ${latestLabel}`,
      value: pkg.name,
      checked: !isMajor, // pre-select non-major updates
    };
  });

  try {
    const selected = await checkbox({
      message: "Select packages to update:",
      choices,
      pageSize: 20,
    });

    if (selected.length === 0) {
      console.log(chalk.gray("\n  No packages selected.\n"));
      return;
    }

    await runUpdates(selected, updaterOpts);
    await checkAndOfferAuditFix(options);
  } catch {
    // User cancelled with Ctrl+C
    console.log(chalk.gray("\n  Update cancelled.\n"));
  }
}

async function runUpdates(names: string[], options: UpdaterOptions): Promise<void> {
  const spinner = ora({
    text: `Updating ${names.length} package${names.length === 1 ? "" : "s"}...`,
    prefixText: " ",
  }).start();

  const results = await updateMultiplePackages(names, options, (result, index, total) => {
    const status = result.success ? chalk.green("OK") : chalk.red("FAIL");
    spinner.text = `[${index + 1}/${total}] ${result.name} ${status}`;
  });

  spinner.stop();

  displayUpdateResults(results);

  // If there are peer dep failures and --force was not used, offer to retry
  const peerDepFailures = results.filter(
    (r) => !r.success && r.error?.includes("Peer dependency conflict")
  );

  if (peerDepFailures.length > 0 && !options.force) {
    try {
      const retry = await confirm({
        message: `${peerDepFailures.length} package${peerDepFailures.length === 1 ? "" : "s"} failed due to peer dependency conflicts. Retry with --force (--legacy-peer-deps)?`,
        default: true,
      });

      if (retry) {
        const retryNames = peerDepFailures.map((r) => r.name);
        const retrySpinner = ora({
          text: `Retrying ${retryNames.length} package${retryNames.length === 1 ? "" : "s"} with --legacy-peer-deps...`,
          prefixText: " ",
        }).start();

        const retryResults = await updateMultiplePackages(
          retryNames,
          { ...options, force: true },
          (result, index, total) => {
            const status = result.success ? chalk.green("OK") : chalk.red("FAIL");
            retrySpinner.text = `[${index + 1}/${total}] ${result.name} ${status}`;
          }
        );

        retrySpinner.stop();
        displayUpdateResults(retryResults);
      }
    } catch {
      // User cancelled
    }
  }
}

async function checkAndOfferAuditFix(options: UpdateOptions): Promise<void> {
  // If --fix was passed, run audit fix automatically
  if (options.fix) {
    await runAuditFixFlow(options.force === true);
    return;
  }

  // Otherwise, check if there are vulnerabilities and offer to fix
  const auditSpinner = ora({
    text: "Checking for vulnerabilities...",
    prefixText: " ",
  }).start();

  const audit = await runAudit();
  auditSpinner.stop();

  if (audit.total === 0) return;

  const fixable = audit.vulnerabilities.filter((v) => v.fixAvailable).length;

  if (fixable === 0) return;

  try {
    const shouldFix = await confirm({
      message: `Found ${audit.total} vulnerabilit${audit.total === 1 ? "y" : "ies"} (${fixable} auto-fixable). Run npm audit fix?`,
      default: true,
    });

    if (shouldFix) {
      await runAuditFixFlow(options.force === true);
    }
  } catch {
    // User cancelled
  }
}

async function runAuditFixFlow(force: boolean): Promise<void> {
  const spinner = ora({
    text: force ? "Running npm audit fix --force..." : "Running npm audit fix...",
    prefixText: " ",
  }).start();

  const result = await runAuditFix(force);
  spinner.stop();

  displayAuditFixResult(result);

  // If fix failed due to ERESOLVE and force was not used, offer retry
  if (!result.success && result.error?.includes("--force") && !force) {
    try {
      const retry = await confirm({
        message: "Audit fix failed due to dependency conflicts. Retry with --force?",
        default: false,
      });

      if (retry) {
        const retrySpinner = ora({
          text: "Running npm audit fix --force...",
          prefixText: " ",
        }).start();

        const retryResult = await runAuditFix(true);
        retrySpinner.stop();

        displayAuditFixResult(retryResult);
      }
    } catch {
      // User cancelled
    }
  }
}

function isMajorUpdate(current: string, latest: string): boolean {
  const currentMajor = parseInt(current.replace(/^[^0-9]*/, "").split(".")[0], 10);
  const latestMajor = parseInt(latest.replace(/^[^0-9]*/, "").split(".")[0], 10);
  return !isNaN(currentMajor) && !isNaN(latestMajor) && latestMajor > currentMajor;
}
