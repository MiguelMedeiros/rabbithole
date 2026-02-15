import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  displaySummary,
  displayVulnerabilities,
  displayOutdated,
  displayDeprecated,
  displayStale,
  displayUpdateResults,
  displayAuditFixResult,
  displayFullReport,
} from "./display.js";
import type {
  AuditFixResult,
  AuditResult,
  OutdatedResult,
  RegistryMetadata,
  ScanReport,
  UpdateResult,
} from "./types.js";

let consoleOutput: string[];

beforeEach(() => {
  consoleOutput = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    consoleOutput.push(args.map(String).join(" "));
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function output(): string {
  return consoleOutput.join("\n");
}

describe("displaySummary", () => {
  it("should show green indicators when everything is healthy", () => {
    const report: ScanReport = {
      audit: {
        vulnerabilities: [],
        summary: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
        total: 0,
      },
      outdated: { packages: [], total: 0 },
      deprecated: [],
      stale: [],
    };

    displaySummary(report);

    expect(output()).toContain("No vulnerabilities");
    expect(output()).toContain("All packages up to date");
    expect(output()).toContain("No deprecated packages");
  });

  it("should show vulnerability counts by severity", () => {
    const report: ScanReport = {
      audit: {
        vulnerabilities: [],
        summary: { critical: 1, high: 2, moderate: 0, low: 0, info: 0 },
        total: 3,
      },
      outdated: { packages: [], total: 0 },
      deprecated: [],
      stale: [],
    };

    displaySummary(report);

    expect(output()).toContain("3");
    expect(output()).toContain("vulnerabilities");
  });

  it("should show outdated count", () => {
    const report: ScanReport = {
      audit: {
        vulnerabilities: [],
        summary: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
        total: 0,
      },
      outdated: { packages: [], total: 5 },
      deprecated: [],
      stale: [],
    };

    displaySummary(report);

    expect(output()).toContain("5");
    expect(output()).toContain("outdated");
  });

  it("should show deprecated and stale counts", () => {
    const report: ScanReport = {
      audit: {
        vulnerabilities: [],
        summary: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
        total: 0,
      },
      outdated: { packages: [], total: 0 },
      deprecated: [
        {
          name: "old-pkg",
          deprecated: "Use new-pkg",
          lastPublishDate: "",
          lastPublishAge: "3 years ago",
          isStale: true,
        },
      ],
      stale: [
        {
          name: "stale-pkg",
          deprecated: false,
          lastPublishDate: "",
          lastPublishAge: "2y 6m ago",
          isStale: true,
        },
      ],
    };

    displaySummary(report);

    expect(output()).toContain("1");
    expect(output()).toContain("deprecated");
    expect(output()).toContain("stale");
  });

  it("should use singular forms for count of 1", () => {
    const report: ScanReport = {
      audit: {
        vulnerabilities: [],
        summary: { critical: 1, high: 0, moderate: 0, low: 0, info: 0 },
        total: 1,
      },
      outdated: { packages: [], total: 1 },
      deprecated: [],
      stale: [],
    };

    displaySummary(report);

    expect(output()).toContain("vulnerability");
    expect(output()).not.toContain("vulnerabilities");
  });
});

describe("displayVulnerabilities", () => {
  it("should not output anything when no vulnerabilities", () => {
    const audit: AuditResult = {
      vulnerabilities: [],
      summary: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
      total: 0,
    };

    displayVulnerabilities(audit);

    expect(consoleOutput).toHaveLength(0);
  });

  it("should display vulnerability table", () => {
    const audit: AuditResult = {
      vulnerabilities: [
        {
          name: "lodash",
          severity: "high",
          title: "Prototype Pollution",
          url: "https://example.com",
          range: "<4.17.21",
          fixAvailable: { name: "lodash", version: "4.17.21" },
        },
      ],
      summary: { critical: 0, high: 1, moderate: 0, low: 0, info: 0 },
      total: 1,
    };

    displayVulnerabilities(audit);

    expect(output()).toContain("Vulnerabilities");
    expect(output()).toContain("lodash");
    expect(output()).toContain("Prototype Pollution");
  });
});

describe("displayOutdated", () => {
  it("should not output anything when no outdated packages", () => {
    const outdated: OutdatedResult = { packages: [], total: 0 };

    displayOutdated(outdated);

    expect(consoleOutput).toHaveLength(0);
  });

  it("should display outdated table with types", () => {
    const outdated: OutdatedResult = {
      packages: [
        {
          name: "express",
          current: "4.18.0",
          wanted: "4.19.0",
          latest: "5.0.0",
          location: "",
          type: "dependencies",
        },
        {
          name: "vitest",
          current: "1.0.0",
          wanted: "1.1.0",
          latest: "2.0.0",
          location: "",
          type: "devDependencies",
        },
      ],
      total: 2,
    };

    displayOutdated(outdated);

    expect(output()).toContain("Outdated");
    expect(output()).toContain("express");
    expect(output()).toContain("vitest");
    expect(output()).toContain("prod");
    expect(output()).toContain("dev");
  });
});

describe("displayDeprecated", () => {
  it("should not output anything for empty list", () => {
    displayDeprecated([]);
    expect(consoleOutput).toHaveLength(0);
  });

  it("should display deprecated packages", () => {
    const deprecated: RegistryMetadata[] = [
      {
        name: "request",
        deprecated: "Use node-fetch or axios instead",
        lastPublishDate: "2020-01-01",
        lastPublishAge: "6 years ago",
        isStale: true,
      },
    ];

    displayDeprecated(deprecated);

    expect(output()).toContain("Deprecated");
    expect(output()).toContain("request");
  });
});

describe("displayStale", () => {
  it("should not output anything for empty list", () => {
    displayStale([]);
    expect(consoleOutput).toHaveLength(0);
  });

  it("should display stale packages", () => {
    const stale: RegistryMetadata[] = [
      {
        name: "old-lib",
        deprecated: false,
        lastPublishDate: "2022-01-01",
        lastPublishAge: "4 years ago",
        isStale: true,
      },
    ];

    displayStale(stale);

    expect(output()).toContain("Stale");
    expect(output()).toContain("old-lib");
    expect(output()).toContain("4 years ago");
  });
});

describe("displayUpdateResults", () => {
  it("should show all success message when no failures", () => {
    const results: UpdateResult[] = [
      {
        name: "express",
        previousVersion: "4.18.0",
        newVersion: "5.0.0",
        success: true,
      },
    ];

    displayUpdateResults(results);

    expect(output()).toContain("Update Results");
    expect(output()).toContain("express");
    expect(output()).toContain("OK");
    expect(output()).toContain("updated successfully");
    expect(output()).toContain("kung fu");
  });

  it("should show failure details when packages fail", () => {
    const results: UpdateResult[] = [
      {
        name: "express",
        previousVersion: "4.18.0",
        newVersion: "5.0.0",
        success: true,
      },
      {
        name: "storybook",
        previousVersion: "10.0.0",
        newVersion: "10.0.0",
        success: false,
        error: "Peer dependency conflict (use --force to bypass)",
      },
    ];

    displayUpdateResults(results);

    expect(output()).toContain("1 updated");
    expect(output()).toContain("1 failed");
    expect(output()).toContain("Errors");
    expect(output()).toContain("storybook");
    expect(output()).toContain("Peer dependency conflict");
    expect(output()).toContain("Not like this");
  });

  it("should handle all failures", () => {
    const results: UpdateResult[] = [
      {
        name: "pkg-a",
        previousVersion: "1.0.0",
        newVersion: "1.0.0",
        success: false,
        error: "Network error",
      },
    ];

    displayUpdateResults(results);

    expect(output()).toContain("0 updated");
    expect(output()).toContain("1 failed");
  });
});

describe("displayAuditFixResult", () => {
  it("should show fixed count and remaining count", () => {
    const result: AuditFixResult = {
      success: true,
      added: 1,
      removed: 0,
      changed: 3,
      fixedVulnerabilities: 2,
      remainingVulnerabilities: 1,
    };

    displayAuditFixResult(result);

    expect(output()).toContain("Fixed");
    expect(output()).toContain("2");
    expect(output()).toContain("1");
    expect(output()).toContain("remaining");
  });

  it("should show all resolved message when no remaining vulns", () => {
    const result: AuditFixResult = {
      success: true,
      added: 0,
      removed: 0,
      changed: 1,
      fixedVulnerabilities: 3,
      remainingVulnerabilities: 0,
    };

    displayAuditFixResult(result);

    expect(output()).toContain("All vulnerabilities resolved");
  });

  it("should show not auto-fixable when nothing was fixed", () => {
    const result: AuditFixResult = {
      success: true,
      added: 0,
      removed: 0,
      changed: 0,
      fixedVulnerabilities: 0,
      remainingVulnerabilities: 2,
    };

    displayAuditFixResult(result);

    expect(output()).toContain("No vulnerabilities were auto-fixable");
  });

  it("should show error message on failure", () => {
    const result: AuditFixResult = {
      success: false,
      added: 0,
      removed: 0,
      changed: 0,
      fixedVulnerabilities: 0,
      remainingVulnerabilities: 0,
      error: "npm audit fix failed",
    };

    displayAuditFixResult(result);

    expect(output()).toContain("npm audit fix failed");
  });
});

describe("displayFullReport", () => {
  it("should display header and all sections", () => {
    const report: ScanReport = {
      audit: {
        vulnerabilities: [],
        summary: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
        total: 0,
      },
      outdated: { packages: [], total: 0 },
      deprecated: [],
      stale: [],
    };

    displayFullReport(report);

    expect(output()).toContain("rabbithole");
    expect(output()).toContain("scan");
    expect(output()).toContain("follow the white rabbit");
    expect(output()).toContain("Summary");
    expect(output()).toContain("Zion");
  });
});
