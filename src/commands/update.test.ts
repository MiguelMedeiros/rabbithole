import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { updateCommand } from "./update.js";

vi.mock("../services/outdated.js", () => ({
  getOutdated: vi.fn(),
}));

vi.mock("../services/audit.js", () => ({
  runAudit: vi.fn(),
  runAuditFix: vi.fn(),
}));

vi.mock("../services/updater.js", () => ({
  updateMultiplePackages: vi.fn(),
}));

vi.mock("../utils/display.js", () => ({
  displayUpdateResults: vi.fn(),
  displayAuditFixResult: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
  checkbox: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("ora", () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn(),
    fail: vi.fn(),
    text: "",
  }),
}));

import { getOutdated } from "../services/outdated.js";
import { runAudit, runAuditFix } from "../services/audit.js";
import { updateMultiplePackages } from "../services/updater.js";
import { displayUpdateResults, displayAuditFixResult } from "../utils/display.js";
import { checkbox, confirm } from "@inquirer/prompts";

const mockGetOutdated = vi.mocked(getOutdated);
const mockRunAudit = vi.mocked(runAudit);
const mockRunAuditFix = vi.mocked(runAuditFix);
const mockUpdateMultiplePackages = vi.mocked(updateMultiplePackages);
const mockDisplayUpdateResults = vi.mocked(displayUpdateResults);
const mockDisplayAuditFixResult = vi.mocked(displayAuditFixResult);
const mockCheckbox = vi.mocked(checkbox);
const mockConfirm = vi.mocked(confirm);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  // Default: return no results so tests that don't set this won't leak
  mockUpdateMultiplePackages.mockResolvedValue([]);
  mockConfirm.mockResolvedValue(false);
  // Default: no vulnerabilities (so audit fix flow is not triggered)
  mockRunAudit.mockResolvedValue({
    vulnerabilities: [],
    summary: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
    total: 0,
  });
  mockRunAuditFix.mockResolvedValue({
    success: true,
    added: 0,
    removed: 0,
    changed: 0,
    fixedVulnerabilities: 0,
    remainingVulnerabilities: 0,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("updateCommand", () => {
  it("should update specific packages directly when names are provided", async () => {
    mockUpdateMultiplePackages.mockResolvedValue([
      {
        name: "express",
        previousVersion: "4.18.0",
        newVersion: "5.0.0",
        success: true,
      },
    ]);

    await updateCommand(["express"], { exact: true });

    expect(mockUpdateMultiplePackages).toHaveBeenCalledWith(
      ["express"],
      { exact: true, force: false },
      expect.any(Function)
    );
    expect(mockDisplayUpdateResults).toHaveBeenCalled();
  });

  it("should show message when all packages are up to date", async () => {
    mockGetOutdated.mockResolvedValue({ packages: [], total: 0 });
    const logSpy = vi.spyOn(console, "log");

    await updateCommand([], {});

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("up to date"));
  });

  it("should update all outdated packages when --all is set", async () => {
    mockGetOutdated.mockResolvedValue({
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
          name: "lodash",
          current: "4.17.0",
          wanted: "4.17.21",
          latest: "4.17.21",
          location: "",
          type: "dependencies",
        },
      ],
      total: 2,
    });

    mockUpdateMultiplePackages.mockResolvedValue([
      {
        name: "express",
        previousVersion: "4.18.0",
        newVersion: "5.0.0",
        success: true,
      },
      {
        name: "lodash",
        previousVersion: "4.17.0",
        newVersion: "4.17.21",
        success: true,
      },
    ]);

    await updateCommand([], { all: true });

    expect(mockUpdateMultiplePackages).toHaveBeenCalledWith(
      ["express", "lodash"],
      expect.objectContaining({ exact: true }),
      expect.any(Function)
    );
  });

  it("should use interactive checkbox when no args and no --all", async () => {
    mockGetOutdated.mockResolvedValue({
      packages: [
        {
          name: "express",
          current: "4.18.0",
          wanted: "4.19.0",
          latest: "4.19.0",
          location: "",
          type: "dependencies",
        },
      ],
      total: 1,
    });

    mockCheckbox.mockResolvedValue(["express"]);
    mockUpdateMultiplePackages.mockResolvedValue([
      {
        name: "express",
        previousVersion: "4.18.0",
        newVersion: "4.19.0",
        success: true,
      },
    ]);

    await updateCommand([], {});

    expect(mockCheckbox).toHaveBeenCalled();
    expect(mockUpdateMultiplePackages).toHaveBeenCalledWith(
      ["express"],
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should show message when no packages selected in interactive mode", async () => {
    mockGetOutdated.mockResolvedValue({
      packages: [
        {
          name: "express",
          current: "4.18.0",
          wanted: "4.19.0",
          latest: "4.19.0",
          location: "",
          type: "dependencies",
        },
      ],
      total: 1,
    });

    mockCheckbox.mockResolvedValue([]);

    await updateCommand([], {});

    expect(mockUpdateMultiplePackages).not.toHaveBeenCalled();
  });

  it("should handle user cancellation (Ctrl+C) gracefully", async () => {
    mockGetOutdated.mockResolvedValue({
      packages: [
        {
          name: "express",
          current: "4.18.0",
          wanted: "4.19.0",
          latest: "4.19.0",
          location: "",
          type: "dependencies",
        },
      ],
      total: 1,
    });

    mockCheckbox.mockRejectedValue(new Error("User cancelled"));

    await updateCommand([], {});

    expect(mockUpdateMultiplePackages).not.toHaveBeenCalled();
  });

  it("should offer retry with --force on peer dep failures", async () => {
    mockUpdateMultiplePackages
      .mockResolvedValueOnce([
        {
          name: "storybook",
          previousVersion: "10.0.0",
          newVersion: "10.0.0",
          success: false,
          error: "Peer dependency conflict (use --force to bypass)",
        },
      ])
      .mockResolvedValueOnce([
        {
          name: "storybook",
          previousVersion: "10.0.0",
          newVersion: "10.1.0",
          success: true,
        },
      ]);

    mockConfirm.mockResolvedValue(true);

    await updateCommand(["storybook"], {});

    expect(mockConfirm).toHaveBeenCalled();
    // Second call should have force: true
    expect(mockUpdateMultiplePackages).toHaveBeenCalledTimes(2);
    expect(mockUpdateMultiplePackages).toHaveBeenLastCalledWith(
      ["storybook"],
      expect.objectContaining({ force: true }),
      expect.any(Function)
    );
  });

  it("should not offer retry when --force is already set", async () => {
    mockUpdateMultiplePackages.mockResolvedValue([
      {
        name: "storybook",
        previousVersion: "10.0.0",
        newVersion: "10.0.0",
        success: false,
        error: "Peer dependency conflict (use --force to bypass)",
      },
    ]);

    await updateCommand(["storybook"], { force: true });

    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("should pass exact: false when --no-exact is set", async () => {
    mockUpdateMultiplePackages.mockResolvedValue([
      {
        name: "express",
        previousVersion: "4.18.0",
        newVersion: "5.0.0",
        success: true,
      },
    ]);

    await updateCommand(["express"], { exact: false });

    expect(mockUpdateMultiplePackages).toHaveBeenCalledWith(
      ["express"],
      expect.objectContaining({ exact: false }),
      expect.any(Function)
    );
  });

  it("should run audit fix directly when --fix is passed without packages", async () => {
    mockRunAuditFix.mockResolvedValue({
      success: true,
      added: 1,
      removed: 0,
      changed: 2,
      fixedVulnerabilities: 1,
      remainingVulnerabilities: 0,
    });

    await updateCommand([], { fix: true });

    expect(mockRunAuditFix).toHaveBeenCalled();
    expect(mockDisplayAuditFixResult).toHaveBeenCalled();
    expect(mockUpdateMultiplePackages).not.toHaveBeenCalled();
  });

  it("should offer audit fix after updating when vulnerabilities exist", async () => {
    mockUpdateMultiplePackages.mockResolvedValue([
      {
        name: "express",
        previousVersion: "4.18.0",
        newVersion: "5.0.0",
        success: true,
      },
    ]);

    mockRunAudit.mockResolvedValue({
      vulnerabilities: [
        {
          name: "lodash",
          severity: "high",
          title: "Prototype Pollution",
          url: "",
          range: "*",
          fixAvailable: true,
        },
      ],
      summary: { critical: 0, high: 1, moderate: 0, low: 0, info: 0 },
      total: 1,
    });

    mockConfirm.mockResolvedValue(true);
    mockRunAuditFix.mockResolvedValue({
      success: true,
      added: 0,
      removed: 0,
      changed: 1,
      fixedVulnerabilities: 1,
      remainingVulnerabilities: 0,
    });

    await updateCommand(["express"], {});

    expect(mockRunAudit).toHaveBeenCalled();
    expect(mockConfirm).toHaveBeenCalled();
    expect(mockRunAuditFix).toHaveBeenCalled();
    expect(mockDisplayAuditFixResult).toHaveBeenCalled();
  });

  it("should not offer audit fix when no fixable vulnerabilities", async () => {
    mockUpdateMultiplePackages.mockResolvedValue([
      {
        name: "express",
        previousVersion: "4.18.0",
        newVersion: "5.0.0",
        success: true,
      },
    ]);

    mockRunAudit.mockResolvedValue({
      vulnerabilities: [
        {
          name: "lodash",
          severity: "high",
          title: "Issue",
          url: "",
          range: "*",
          fixAvailable: false,
        },
      ],
      summary: { critical: 0, high: 1, moderate: 0, low: 0, info: 0 },
      total: 1,
    });

    await updateCommand(["express"], {});

    // Should not offer to fix since none are auto-fixable
    expect(mockRunAuditFix).not.toHaveBeenCalled();
  });
});
