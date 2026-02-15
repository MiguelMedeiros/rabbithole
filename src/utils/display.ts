import chalk from "chalk";
import Table from "cli-table3";
import type {
  AuditFixResult,
  AuditResult,
  OutdatedResult,
  RegistryMetadata,
  ScanReport,
  SeverityLevel,
  UpdateResult,
} from "./types.js";

// ── ASCII Art & Matrix quotes ──

const RABBIT = `
    ${chalk.white("(\\(\\")}
    ${chalk.white("( -.-)")}  ${chalk.gray("follow the white rabbit...")}
    ${chalk.white('o_(")(")')}`;

const RABBIT_CLEAN = `
    ${chalk.green("(\\(\\")}
    ${chalk.green("( ^.^)")}  ${chalk.green("Welcome to Zion. All clear.")}
    ${chalk.green('o_(")(")')}`;

const RABBIT_ISSUES = `
    ${chalk.red("(\\(\\")}
    ${chalk.red("( o.o)")}  ${chalk.yellow("A glitch in the Matrix...")}
    ${chalk.red('o_(")(")')}`;

// ── Severity colors ──

const severityColor: Record<SeverityLevel, (text: string) => string> = {
  critical: chalk.bgRed.white.bold,
  high: chalk.red.bold,
  moderate: chalk.yellow,
  low: chalk.blue,
  info: chalk.gray,
};

const severityIcon: Record<SeverityLevel, string> = {
  critical: "!!!",
  high: "!!",
  moderate: "!",
  low: "~",
  info: "i",
};

// ── Summary display ──

export function displaySummary(report: ScanReport): void {
  console.log();
  console.log(chalk.bold.white("  Summary"));
  console.log();

  // Vulnerabilities
  if (report.audit.total > 0) {
    const parts: string[] = [];
    for (const level of ["critical", "high", "moderate", "low"] as SeverityLevel[]) {
      const count = report.audit.summary[level];
      if (count > 0) {
        parts.push(severityColor[level](`${count} ${level}`));
      }
    }
    console.log(
      `  ${chalk.red("●")} ${chalk.bold(report.audit.total)} vulnerabilit${report.audit.total === 1 ? "y" : "ies"} ${chalk.gray("(")}${parts.join(chalk.gray(", "))}${chalk.gray(")")}`
    );
  } else {
    console.log(`  ${chalk.green("●")} ${chalk.green("No vulnerabilities")}`);
  }

  // Outdated
  if (report.outdated.total > 0) {
    console.log(
      `  ${chalk.yellow("●")} ${chalk.bold(report.outdated.total)} outdated package${report.outdated.total === 1 ? "" : "s"}`
    );
  } else {
    console.log(`  ${chalk.green("●")} ${chalk.green("All packages up to date")}`);
  }

  // Deprecated
  if (report.deprecated.length > 0) {
    console.log(
      `  ${chalk.red("●")} ${chalk.bold(report.deprecated.length)} deprecated package${report.deprecated.length === 1 ? "" : "s"}`
    );
  } else {
    console.log(`  ${chalk.green("●")} ${chalk.green("No deprecated packages")}`);
  }

  // Stale
  if (report.stale.length > 0) {
    console.log(
      `  ${chalk.yellow("●")} ${chalk.bold(report.stale.length)} stale package${report.stale.length === 1 ? "" : "s"} ${chalk.gray("(no update in 2+ years)")}`
    );
  }

  console.log();
}

// ── Vulnerability table ──

export function displayVulnerabilities(audit: AuditResult): void {
  if (audit.total === 0) return;

  console.log(chalk.bold.red("  Vulnerabilities"));
  console.log();

  const table = new Table({
    head: [
      chalk.gray("Severity"),
      chalk.gray("Package"),
      chalk.gray("Title"),
      chalk.gray("Fix Available"),
    ],
    style: { head: [], border: ["gray"], "padding-left": 1, "padding-right": 1 },
    colWidths: [12, 22, 40, 16],
    wordWrap: true,
  });

  for (const vuln of audit.vulnerabilities) {
    const sevLabel = severityColor[vuln.severity](
      ` ${severityIcon[vuln.severity]} ${vuln.severity.toUpperCase()} `
    );
    const fixLabel =
      typeof vuln.fixAvailable === "object"
        ? chalk.green(`${vuln.fixAvailable.name}@${vuln.fixAvailable.version}`)
        : vuln.fixAvailable
          ? chalk.green("Yes")
          : chalk.red("No");

    table.push([sevLabel, vuln.name, vuln.title, fixLabel]);
  }

  console.log(table.toString());
  console.log();
}

// ── Outdated table ──

export function displayOutdated(outdated: OutdatedResult): void {
  if (outdated.total === 0) return;

  console.log(chalk.bold.yellow("  Outdated Packages"));
  console.log();

  const table = new Table({
    head: [
      chalk.gray("Package"),
      chalk.gray("Current"),
      chalk.gray("Latest"),
      chalk.gray("Type"),
    ],
    style: { head: [], border: ["gray"], "padding-left": 1, "padding-right": 1 },
    colWidths: [30, 14, 14, 18],
  });

  for (const pkg of outdated.packages) {
    const isMajor = isMajorUpdate(pkg.current, pkg.latest);
    const latestLabel = isMajor ? chalk.red.bold(pkg.latest) : chalk.green(pkg.latest);
    const typeLabel =
      pkg.type === "devDependencies" ? chalk.gray("dev") : chalk.cyan("prod");

    table.push([pkg.name, chalk.yellow(pkg.current), latestLabel, typeLabel]);
  }

  console.log(table.toString());
  console.log();
}

// ── Deprecated table ──

export function displayDeprecated(deprecated: RegistryMetadata[]): void {
  if (deprecated.length === 0) return;

  console.log(chalk.bold.red("  Deprecated Packages"));
  console.log();

  const table = new Table({
    head: [chalk.gray("Package"), chalk.gray("Reason"), chalk.gray("Last Update")],
    style: { head: [], border: ["gray"], "padding-left": 1, "padding-right": 1 },
    colWidths: [25, 40, 18],
    wordWrap: true,
  });

  for (const pkg of deprecated) {
    table.push([
      pkg.name,
      chalk.red(pkg.deprecated || "No reason given"),
      chalk.gray(pkg.lastPublishAge),
    ]);
  }

  console.log(table.toString());
  console.log();
}

// ── Stale table ──

export function displayStale(stale: RegistryMetadata[]): void {
  if (stale.length === 0) return;

  console.log(chalk.bold.yellow("  Stale Packages (no update in 2+ years)"));
  console.log();

  const table = new Table({
    head: [chalk.gray("Package"), chalk.gray("Last Update")],
    style: { head: [], border: ["gray"], "padding-left": 1, "padding-right": 1 },
    colWidths: [35, 25],
  });

  for (const pkg of stale) {
    table.push([pkg.name, chalk.yellow(`${pkg.lastPublishAge}`)]);
  }

  console.log(table.toString());
  console.log();
}

// ── Update results display ──

export function displayUpdateResults(results: UpdateResult[]): void {
  console.log();
  console.log(chalk.bold.white("  Update Results"));
  console.log();

  const table = new Table({
    head: [
      chalk.gray("Package"),
      chalk.gray("Previous"),
      chalk.gray("New"),
      chalk.gray("Status"),
    ],
    style: { head: [], border: ["gray"], "padding-left": 1, "padding-right": 1 },
    colWidths: [30, 16, 16, 12],
  });

  for (const result of results) {
    table.push([
      result.name,
      chalk.yellow(result.previousVersion),
      result.success ? chalk.green(result.newVersion) : chalk.red(result.newVersion),
      result.success ? chalk.green("OK") : chalk.red("FAIL"),
    ]);
  }

  console.log(table.toString());

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log();
  if (failed === 0) {
    console.log(
      chalk.green(
        `  All ${succeeded} package${succeeded === 1 ? "" : "s"} updated successfully.`
      )
    );
    console.log(chalk.gray('  "I know kung fu." — You know fresh deps.'));
  } else {
    console.log(
      chalk.yellow(`  ${succeeded} updated, ${chalk.red(`${failed} failed`)}.`)
    );

    // Show error details for failed packages
    const failedResults = results.filter((r) => !r.success);
    console.log();
    console.log(chalk.bold.red("  Errors"));
    console.log();
    for (const result of failedResults) {
      console.log(
        `  ${chalk.red("●")} ${chalk.bold(result.name)}: ${chalk.gray(result.error ?? "Unknown error")}`
      );
    }
    console.log();
    console.log(
      chalk.gray('  "Not like this... not like this." — Try again with --force?')
    );
  }
  console.log();
}

// ── Audit fix display ──

export function displayAuditFixResult(result: AuditFixResult): void {
  console.log();
  console.log(chalk.bold.white("  Audit Fix Results"));
  console.log();

  if (!result.success) {
    console.log(
      `  ${chalk.red("●")} ${chalk.red(result.error ?? "npm audit fix failed")}`
    );
    console.log();
    return;
  }

  if (result.fixedVulnerabilities > 0) {
    console.log(
      `  ${chalk.green("●")} Fixed ${chalk.bold(result.fixedVulnerabilities)} vulnerabilit${result.fixedVulnerabilities === 1 ? "y" : "ies"}`
    );
  } else {
    console.log(`  ${chalk.yellow("●")} No vulnerabilities were auto-fixable`);
  }

  if (result.remainingVulnerabilities > 0) {
    console.log(
      `  ${chalk.yellow("●")} ${chalk.bold(result.remainingVulnerabilities)} vulnerabilit${result.remainingVulnerabilities === 1 ? "y" : "ies"} remaining ${chalk.gray("(may require manual review)")}`
    );
  } else if (result.fixedVulnerabilities > 0) {
    console.log(`  ${chalk.green("●")} ${chalk.green("All vulnerabilities resolved!")}`);
  }

  const parts: string[] = [];
  if (result.added > 0) parts.push(`${result.added} added`);
  if (result.removed > 0) parts.push(`${result.removed} removed`);
  if (result.changed > 0) parts.push(`${result.changed} changed`);

  if (parts.length > 0) {
    console.log(`  ${chalk.gray("  " + parts.join(", "))}`);
  }

  // Matrix flavor
  if (
    result.success &&
    result.remainingVulnerabilities === 0 &&
    result.fixedVulnerabilities > 0
  ) {
    console.log();
    console.log(
      chalk.gray('  "There is no spoon." — And there are no more vulnerabilities.')
    );
  }

  console.log();
}

// ── Full scan report display ──

function hasIssues(report: ScanReport): boolean {
  return (
    report.audit.total > 0 ||
    report.outdated.total > 0 ||
    report.deprecated.length > 0 ||
    report.stale.length > 0
  );
}

export function displayFullReport(report: ScanReport): void {
  console.log();
  console.log(chalk.bold.white("  rabbithole") + chalk.gray(" scan"));
  console.log(RABBIT);

  displaySummary(report);
  displayVulnerabilities(report.audit);
  displayOutdated(report.outdated);
  displayDeprecated(report.deprecated);
  displayStale(report.stale);

  // Contextual closing message
  if (!hasIssues(report)) {
    console.log(RABBIT_CLEAN);
  } else {
    console.log(RABBIT_ISSUES);
    console.log(
      chalk.gray(
        '  "I can only show you the door. You\'re the one that has to walk through it."'
      )
    );
    console.log();
  }
}

// ── Helpers ──

function isMajorUpdate(current: string, latest: string): boolean {
  const currentMajor = parseInt(current.replace(/^[^0-9]*/, "").split(".")[0], 10);
  const latestMajor = parseInt(latest.replace(/^[^0-9]*/, "").split(".")[0], 10);
  return !isNaN(currentMajor) && !isNaN(latestMajor) && latestMajor > currentMajor;
}
