import { describe, it, expect, vi, afterEach } from "vitest";
import { runAudit, runAuditFix } from "./audit.js";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "node:child_process";

const mockExecSync = vi.mocked(execSync);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runAudit", () => {
  it("should return empty result when no vulnerabilities", async () => {
    mockExecSync.mockReturnValue(
      JSON.stringify({
        vulnerabilities: {},
      })
    );

    const result = await runAudit();

    expect(result.total).toBe(0);
    expect(result.vulnerabilities).toEqual([]);
    expect(result.summary.critical).toBe(0);
  });

  it("should parse vulnerabilities correctly", async () => {
    const auditOutput = JSON.stringify({
      vulnerabilities: {
        lodash: {
          severity: "high",
          via: [
            {
              title: "Prototype Pollution",
              url: "https://github.com/advisories/123",
            },
          ],
          range: "<4.17.21",
          fixAvailable: { name: "lodash", version: "4.17.21" },
        },
        "node-fetch": {
          severity: "moderate",
          via: [{ title: "Headers exposure", url: "https://example.com" }],
          range: "<2.6.7",
          fixAvailable: true,
        },
      },
    });

    mockExecSync.mockReturnValue(auditOutput);

    const result = await runAudit();

    expect(result.total).toBe(2);
    expect(result.summary.high).toBe(1);
    expect(result.summary.moderate).toBe(1);
    expect(result.vulnerabilities[0].name).toBe("lodash");
    expect(result.vulnerabilities[0].severity).toBe("high");
    expect(result.vulnerabilities[0].title).toBe("Prototype Pollution");
  });

  it("should sort vulnerabilities by severity (critical first)", async () => {
    const auditOutput = JSON.stringify({
      vulnerabilities: {
        low_pkg: {
          severity: "low",
          via: [{ title: "Low issue" }],
          range: "*",
          fixAvailable: false,
        },
        critical_pkg: {
          severity: "critical",
          via: [{ title: "Critical issue" }],
          range: "*",
          fixAvailable: true,
        },
        high_pkg: {
          severity: "high",
          via: [{ title: "High issue" }],
          range: "*",
          fixAvailable: false,
        },
      },
    });

    mockExecSync.mockReturnValue(auditOutput);

    const result = await runAudit();

    expect(result.vulnerabilities[0].severity).toBe("critical");
    expect(result.vulnerabilities[1].severity).toBe("high");
    expect(result.vulnerabilities[2].severity).toBe("low");
  });

  it("should handle transitive vulnerabilities (string via)", async () => {
    const auditOutput = JSON.stringify({
      vulnerabilities: {
        "sub-dep": {
          severity: "moderate",
          via: ["parent-dep"],
          range: "*",
          fixAvailable: false,
        },
      },
    });

    mockExecSync.mockReturnValue(auditOutput);

    const result = await runAudit();

    expect(result.vulnerabilities[0].title).toBe("Transitive vulnerability");
  });

  it("should handle npm audit exit code 1 (vulnerabilities found)", async () => {
    const auditOutput = JSON.stringify({
      vulnerabilities: {
        pkg: {
          severity: "high",
          via: [{ title: "Issue" }],
          range: "*",
          fixAvailable: true,
        },
      },
    });

    mockExecSync.mockImplementation(() => {
      const err = new Error("npm audit failed") as Error & { stdout: string };
      err.stdout = auditOutput;
      throw err;
    });

    const result = await runAudit();

    expect(result.total).toBe(1);
    expect(result.vulnerabilities[0].name).toBe("pkg");
  });

  it("should return empty result when npm audit fails completely", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("Command not found");
    });

    const result = await runAudit();

    expect(result.total).toBe(0);
    expect(result.vulnerabilities).toEqual([]);
  });

  it("should return empty result when no vulnerabilities field in response", async () => {
    mockExecSync.mockReturnValue(JSON.stringify({ auditReportVersion: 2 }));

    const result = await runAudit();

    expect(result.total).toBe(0);
  });
});

describe("runAuditFix", () => {
  it("should run npm audit fix and return results", async () => {
    // First call: npm audit --json (before) — has 1 vuln
    // Second call: npm audit fix
    // Third call: npm audit --json (after) — has 0 vulns
    let callCount = 0;
    mockExecSync.mockImplementation((cmd: string) => {
      const command = String(cmd);
      if (command.includes("npm audit fix")) {
        return "added 1, removed 0, changed 2 packages";
      }
      callCount++;
      if (callCount === 1) {
        // Before: 1 vuln
        return JSON.stringify({
          vulnerabilities: {
            pkg: {
              severity: "low",
              via: [{ title: "Issue" }],
              range: "*",
              fixAvailable: true,
            },
          },
        });
      }
      // After: 0 vulns
      return JSON.stringify({ vulnerabilities: {} });
    });

    const result = await runAuditFix();

    expect(result.success).toBe(true);
    expect(result.fixedVulnerabilities).toBe(1);
    expect(result.remainingVulnerabilities).toBe(0);
    expect(result.added).toBe(1);
    expect(result.changed).toBe(2);
  });

  it("should pass --force flag when requested", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      const command = String(cmd);
      if (command.includes("npm audit fix")) {
        expect(command).toContain("--force");
        return "added 0, removed 0, changed 0 packages";
      }
      return JSON.stringify({ vulnerabilities: {} });
    });

    const result = await runAuditFix(true);

    expect(result.success).toBe(true);
  });

  it("should handle npm audit fix failure", async () => {
    // Before audit: 1 vuln
    let isAuditFixCall = false;
    mockExecSync.mockImplementation((cmd: string) => {
      const command = String(cmd);
      if (command.includes("npm audit fix")) {
        isAuditFixCall = true;
        const err = new Error("failed") as Error & { stderr: string };
        err.stderr = "npm ERR! ERESOLVE could not resolve";
        throw err;
      }
      if (!isAuditFixCall) {
        return JSON.stringify({
          vulnerabilities: {
            pkg: {
              severity: "high",
              via: [{ title: "Issue" }],
              range: "*",
              fixAvailable: true,
            },
          },
        });
      }
      return JSON.stringify({ vulnerabilities: {} });
    });

    const result = await runAuditFix();

    expect(result.success).toBe(false);
    expect(result.error).toContain("--force");
  });
});
