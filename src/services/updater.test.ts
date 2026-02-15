import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { extractErrorReason, updatePackage, updateMultiplePackages } from "./updater.js";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const mockExecSync = vi.mocked(execSync);
const mockReadFileSync = vi.mocked(readFileSync);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("extractErrorReason", () => {
  it("should detect ERESOLVE peer dependency conflicts", () => {
    const stderr = "npm error code ERESOLVE\nnpm error ERESOLVE could not resolve";
    expect(extractErrorReason(stderr)).toBe(
      "Peer dependency conflict (use --force to bypass)"
    );
  });

  it("should detect 404 not found errors", () => {
    const stderr = "npm error 404 Not Found - GET https://registry.npmjs.org/foo";
    expect(extractErrorReason(stderr)).toBe("Package not found in registry");
  });

  it("should detect permission errors", () => {
    const stderr = "npm error Error: EACCES: permission denied";
    expect(extractErrorReason(stderr)).toBe("Permission denied");
  });

  it("should detect network timeout errors", () => {
    expect(extractErrorReason("npm error ETIMEDOUT")).toBe("Network error");
  });

  it("should detect DNS errors", () => {
    expect(extractErrorReason("npm error ENOTFOUND")).toBe("Network error");
  });

  it("should extract npm ERR! lines as fallback", () => {
    const stderr = "some output\nnpm ERR! Could not install package";
    expect(extractErrorReason(stderr)).toBe("Could not install package");
  });

  it("should extract npm error lines as fallback", () => {
    const stderr = "some output\nnpm error something went wrong";
    expect(extractErrorReason(stderr)).toBe("something went wrong");
  });

  it("should return Unknown error for unrecognized stderr", () => {
    expect(extractErrorReason("random garbage")).toBe("Unknown error");
  });

  it("should return Unknown error for empty stderr", () => {
    expect(extractErrorReason("")).toBe("Unknown error");
  });
});

describe("updatePackage", () => {
  const pkgJsonBefore = JSON.stringify({
    dependencies: { express: "4.18.0" },
    devDependencies: { vitest: "1.0.0" },
  });

  const pkgJsonAfterExpress = JSON.stringify({
    dependencies: { express: "5.0.0" },
    devDependencies: { vitest: "1.0.0" },
  });

  it("should update a production dependency with --save-exact", async () => {
    let callCount = 0;
    mockReadFileSync.mockImplementation(() => {
      callCount++;
      // First call reads before version, second reads after
      return callCount <= 2 ? pkgJsonBefore : pkgJsonAfterExpress;
    });
    mockExecSync.mockReturnValue("");

    const result = await updatePackage("express", { exact: true, force: false });

    expect(result.success).toBe(true);
    expect(result.previousVersion).toBe("4.18.0");
    expect(result.newVersion).toBe("5.0.0");

    const cmd = mockExecSync.mock.calls[0][0] as string;
    expect(cmd).toContain("npm install express@latest");
    expect(cmd).toContain("--save-exact");
    expect(cmd).toContain("--save");
    expect(cmd).not.toContain("--save-dev");
  });

  it("should update a dev dependency with --save-dev", async () => {
    // readFileSync is called 3 times: getCurrentVersion, isDevDep, getCurrentVersion (after)
    mockReadFileSync
      .mockReturnValueOnce(pkgJsonBefore) // getCurrentVersion
      .mockReturnValueOnce(pkgJsonBefore) // isDevDep
      .mockReturnValueOnce(
        // getCurrentVersion after update
        JSON.stringify({
          dependencies: { express: "4.18.0" },
          devDependencies: { vitest: "2.0.0" },
        })
      );
    mockExecSync.mockReturnValue("");

    const result = await updatePackage("vitest", { exact: true, force: false });

    expect(result.success).toBe(true);
    const cmd = mockExecSync.mock.calls[0][0] as string;
    expect(cmd).toContain("--save-dev");
  });

  it("should use --legacy-peer-deps when force is true", async () => {
    mockReadFileSync.mockReturnValue(pkgJsonBefore);
    mockExecSync.mockReturnValue("");

    await updatePackage("express", { exact: true, force: true });

    const cmd = mockExecSync.mock.calls[0][0] as string;
    expect(cmd).toContain("--legacy-peer-deps");
  });

  it("should not use --save-exact when exact is false", async () => {
    mockReadFileSync.mockReturnValue(pkgJsonBefore);
    mockExecSync.mockReturnValue("");

    await updatePackage("express", { exact: false, force: false });

    const cmd = mockExecSync.mock.calls[0][0] as string;
    expect(cmd).not.toContain("--save-exact");
  });

  it("should return failure with error reason on npm install failure", async () => {
    mockReadFileSync.mockReturnValue(pkgJsonBefore);
    mockExecSync.mockImplementation(() => {
      const err = new Error("install failed") as Error & { stderr: string };
      err.stderr = "npm error code ERESOLVE\nnpm error ERESOLVE could not resolve";
      throw err;
    });

    const result = await updatePackage("express", { exact: true, force: false });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Peer dependency conflict (use --force to bypass)");
    expect(result.newVersion).toBe("4.18.0"); // unchanged
  });

  it("should handle unknown package version", async () => {
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ dependencies: {}, devDependencies: {} })
    );
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });

    const result = await updatePackage("nonexistent", { exact: true, force: false });

    expect(result.success).toBe(false);
    expect(result.previousVersion).toBe("unknown");
  });
});

describe("updateMultiplePackages", () => {
  it("should update multiple packages and call progress callback", async () => {
    const versions = ["4.18.0", "1.0.0"];
    const newVersions = ["5.0.0", "2.0.0"];
    let readCount = 0;

    mockReadFileSync.mockImplementation(() => {
      readCount++;
      // Alternate between before/after for each package
      const pkgIndex = Math.floor((readCount - 1) / 3);
      const isAfter = (readCount - 1) % 3 === 2;
      const v = isAfter ? newVersions[pkgIndex] : versions[pkgIndex];
      return JSON.stringify({
        dependencies: { express: pkgIndex === 0 ? v : "4.18.0" },
        devDependencies: { vitest: pkgIndex === 1 ? v : "1.0.0" },
      });
    });
    mockExecSync.mockReturnValue("");

    const progress = vi.fn();

    const results = await updateMultiplePackages(
      ["express", "vitest"],
      { exact: true, force: false },
      progress
    );

    expect(results).toHaveLength(2);
    expect(progress).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({ name: "express" }),
      0,
      2
    );
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({ name: "vitest" }),
      1,
      2
    );
  });

  it("should handle empty package list", async () => {
    const results = await updateMultiplePackages([], { exact: true, force: false });
    expect(results).toEqual([]);
  });
});
