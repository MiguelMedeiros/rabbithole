import { execSync } from "node:child_process";
import type {
  AuditResult,
  AuditFixResult,
  SeverityLevel,
  Vulnerability,
} from "../utils/types.js";

export async function runAudit(): Promise<AuditResult> {
  const severityLevels: SeverityLevel[] = ["critical", "high", "moderate", "low", "info"];

  const emptySummary: Record<SeverityLevel, number> = {
    critical: 0,
    high: 0,
    moderate: 0,
    low: 0,
    info: 0,
  };

  try {
    // npm audit exits with non-zero when vulnerabilities are found,
    // so we need to capture output regardless of exit code
    let stdout: string;
    try {
      stdout = execSync("npm audit --json", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err: unknown) {
      const execErr = err as { stdout?: string };
      if (execErr.stdout) {
        stdout = execErr.stdout;
      } else {
        return { vulnerabilities: [], summary: emptySummary, total: 0 };
      }
    }

    const data = JSON.parse(stdout);

    // npm audit v7+ format
    if (!data.vulnerabilities) {
      return { vulnerabilities: [], summary: emptySummary, total: 0 };
    }

    const vulnerabilities: Vulnerability[] = [];
    const summary: Record<SeverityLevel, number> = { ...emptySummary };

    for (const [name, vuln] of Object.entries(data.vulnerabilities)) {
      const v = vuln as {
        severity: SeverityLevel;
        via: Array<{ title?: string; url?: string }> | string[];
        range: string;
        fixAvailable: boolean | { name: string; version: string };
      };

      // "via" can be strings (transitive) or objects (direct)
      const directVia = v.via.find(
        (item): item is { title?: string; url?: string } =>
          typeof item === "object" && "title" in item
      );

      vulnerabilities.push({
        name,
        severity: v.severity,
        title: directVia?.title ?? "Transitive vulnerability",
        url: directVia?.url ?? "",
        range: v.range,
        fixAvailable: v.fixAvailable,
      });

      if (severityLevels.includes(v.severity)) {
        summary[v.severity]++;
      }
    }

    // Sort by severity: critical first
    const severityOrder: Record<SeverityLevel, number> = {
      critical: 0,
      high: 1,
      moderate: 2,
      low: 3,
      info: 4,
    };
    vulnerabilities.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return {
      vulnerabilities,
      summary,
      total: vulnerabilities.length,
    };
  } catch {
    return { vulnerabilities: [], summary: emptySummary, total: 0 };
  }
}

export async function runAuditFix(force: boolean = false): Promise<AuditFixResult> {
  try {
    // Run audit before fix to get the initial count
    const before = await runAudit();

    const forceFlag = force ? " --force" : "";
    const cmd = `npm audit fix${forceFlag}`;

    let stdout: string;
    try {
      stdout = execSync(cmd, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string };
      // npm audit fix can exit non-zero but still fix things
      if (execErr.stdout) {
        stdout = execErr.stdout;
      } else {
        const stderr = execErr.stderr ?? "";
        return {
          success: false,
          added: 0,
          removed: 0,
          changed: 0,
          fixedVulnerabilities: 0,
          remainingVulnerabilities: before.total,
          error: stderr.includes("ERESOLVE")
            ? "Could not resolve dependencies. Try with --force."
            : "npm audit fix failed",
        };
      }
    }

    // Parse the output for stats (e.g. "added 2, removed 1, changed 5")
    const addedMatch = stdout.match(/added\s+(\d+)/);
    const removedMatch = stdout.match(/removed\s+(\d+)/);
    const changedMatch = stdout.match(/changed\s+(\d+)/);

    const added = addedMatch ? parseInt(addedMatch[1], 10) : 0;
    const removed = removedMatch ? parseInt(removedMatch[1], 10) : 0;
    const changed = changedMatch ? parseInt(changedMatch[1], 10) : 0;

    // Run audit again to see remaining vulns
    const after = await runAudit();

    return {
      success: true,
      added,
      removed,
      changed,
      fixedVulnerabilities: Math.max(0, before.total - after.total),
      remainingVulnerabilities: after.total,
    };
  } catch {
    return {
      success: false,
      added: 0,
      removed: 0,
      changed: 0,
      fixedVulnerabilities: 0,
      remainingVulnerabilities: 0,
      error: "Unexpected error running npm audit fix",
    };
  }
}
