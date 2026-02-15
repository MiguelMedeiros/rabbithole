import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scanCommand } from "./scan.js";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

vi.mock("../services/audit.js", () => ({
  runAudit: vi.fn(),
}));

vi.mock("../services/outdated.js", () => ({
  getOutdated: vi.fn(),
}));

vi.mock("../services/registry.js", () => ({
  getMultiplePackageMetadata: vi.fn(),
}));

vi.mock("../utils/display.js", () => ({
  displayFullReport: vi.fn(),
}));

// Mock ora to be a no-op spinner
vi.mock("ora", () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn(),
    fail: vi.fn(),
    text: "",
  }),
}));

import { readFileSync } from "node:fs";
import { runAudit } from "../services/audit.js";
import { getOutdated } from "../services/outdated.js";
import { getMultiplePackageMetadata } from "../services/registry.js";
import { displayFullReport } from "../utils/display.js";

const mockReadFileSync = vi.mocked(readFileSync);
const mockRunAudit = vi.mocked(runAudit);
const mockGetOutdated = vi.mocked(getOutdated);
const mockGetMultiplePackageMetadata = vi.mocked(getMultiplePackageMetadata);
const mockDisplayFullReport = vi.mocked(displayFullReport);

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("scanCommand", () => {
  it("should exit with error if no package.json exists", async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    await scanCommand();

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("should run audit, outdated, and registry checks and display report", async () => {
    const pkgJson = JSON.stringify({
      dependencies: { express: "4.18.0" },
      devDependencies: { vitest: "1.0.0" },
    });

    mockReadFileSync.mockReturnValue(pkgJson);

    mockRunAudit.mockResolvedValue({
      vulnerabilities: [],
      summary: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
      total: 0,
    });

    mockGetOutdated.mockResolvedValue({ packages: [], total: 0 });

    mockGetMultiplePackageMetadata.mockResolvedValue([
      {
        name: "express",
        deprecated: false,
        lastPublishDate: "2026-01-01",
        lastPublishAge: "1 month ago",
        isStale: false,
      },
    ]);

    await scanCommand();

    expect(mockRunAudit).toHaveBeenCalled();
    expect(mockGetOutdated).toHaveBeenCalled();
    expect(mockGetMultiplePackageMetadata).toHaveBeenCalled();
    expect(mockDisplayFullReport).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.any(Object),
        outdated: expect.any(Object),
        deprecated: expect.any(Array),
        stale: expect.any(Array),
      })
    );
  });

  it("should separate deprecated and stale packages", async () => {
    const pkgJson = JSON.stringify({
      dependencies: { "old-pkg": "1.0.0", "stale-pkg": "1.0.0" },
      devDependencies: {},
    });

    mockReadFileSync.mockReturnValue(pkgJson);
    mockRunAudit.mockResolvedValue({
      vulnerabilities: [],
      summary: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
      total: 0,
    });
    mockGetOutdated.mockResolvedValue({ packages: [], total: 0 });
    mockGetMultiplePackageMetadata.mockResolvedValue([
      {
        name: "old-pkg",
        deprecated: "Use new-pkg instead",
        lastPublishDate: "2020-01-01",
        lastPublishAge: "6 years ago",
        isStale: true,
      },
      {
        name: "stale-pkg",
        deprecated: false,
        lastPublishDate: "2022-01-01",
        lastPublishAge: "4 years ago",
        isStale: true,
      },
    ]);

    await scanCommand();

    expect(mockDisplayFullReport).toHaveBeenCalledWith(
      expect.objectContaining({
        deprecated: [
          expect.objectContaining({ name: "old-pkg", deprecated: "Use new-pkg instead" }),
        ],
        stale: [expect.objectContaining({ name: "stale-pkg", isStale: true })],
      })
    );
  });
});
