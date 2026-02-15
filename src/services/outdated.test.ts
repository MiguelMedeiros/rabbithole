import { describe, it, expect, vi, afterEach } from "vitest";
import { getOutdated } from "./outdated.js";

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

const basePkgJson = JSON.stringify({
  dependencies: { express: "^4.18.0", lodash: "^4.17.0" },
  devDependencies: { typescript: "^5.0.0", vitest: "^1.0.0" },
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getOutdated", () => {
  it("should return empty result when all packages are up to date", async () => {
    mockReadFileSync.mockReturnValue(basePkgJson);
    mockExecSync.mockReturnValue("{}");

    const result = await getOutdated();

    expect(result.total).toBe(0);
    expect(result.packages).toEqual([]);
  });

  it("should parse outdated packages correctly", async () => {
    mockReadFileSync.mockReturnValue(basePkgJson);

    const outdatedJson = JSON.stringify({
      express: { current: "4.18.0", wanted: "4.19.0", latest: "5.0.0" },
      typescript: { current: "5.0.0", wanted: "5.3.0", latest: "5.7.0" },
    });

    mockExecSync.mockReturnValue(outdatedJson);

    const result = await getOutdated();

    expect(result.total).toBe(2);
    expect(result.packages[0].name).toBe("express");
    expect(result.packages[0].type).toBe("dependencies");
    expect(result.packages[1].name).toBe("typescript");
    expect(result.packages[1].type).toBe("devDependencies");
  });

  it("should sort dependencies before devDependencies", async () => {
    mockReadFileSync.mockReturnValue(basePkgJson);

    const outdatedJson = JSON.stringify({
      vitest: { current: "1.0.0", wanted: "1.1.0", latest: "2.0.0" },
      lodash: { current: "4.17.0", wanted: "4.17.21", latest: "4.17.21" },
    });

    mockExecSync.mockReturnValue(outdatedJson);

    const result = await getOutdated();

    expect(result.packages[0].name).toBe("lodash");
    expect(result.packages[0].type).toBe("dependencies");
    expect(result.packages[1].name).toBe("vitest");
    expect(result.packages[1].type).toBe("devDependencies");
  });

  it("should handle npm outdated exit code 1", async () => {
    mockReadFileSync.mockReturnValue(basePkgJson);

    const outdatedJson = JSON.stringify({
      express: { current: "4.18.0", wanted: "4.19.0", latest: "5.0.0" },
    });

    mockExecSync.mockImplementation(() => {
      const err = new Error("npm outdated") as Error & { stdout: string };
      err.stdout = outdatedJson;
      throw err;
    });

    const result = await getOutdated();

    expect(result.total).toBe(1);
    expect(result.packages[0].name).toBe("express");
  });

  it("should handle MISSING current versions", async () => {
    mockReadFileSync.mockReturnValue(basePkgJson);

    const outdatedJson = JSON.stringify({
      express: { wanted: "4.19.0", latest: "5.0.0" },
    });

    mockExecSync.mockReturnValue(outdatedJson);

    const result = await getOutdated();

    expect(result.packages[0].current).toBe("MISSING");
  });

  it("should return empty result when npm outdated fails completely", async () => {
    mockReadFileSync.mockReturnValue(basePkgJson);
    mockExecSync.mockImplementation(() => {
      throw new Error("Command failed");
    });

    const result = await getOutdated();

    expect(result.total).toBe(0);
  });

  it("should sort alphabetically within same type", async () => {
    mockReadFileSync.mockReturnValue(basePkgJson);

    const outdatedJson = JSON.stringify({
      lodash: { current: "4.17.0", wanted: "4.17.21", latest: "4.17.21" },
      express: { current: "4.18.0", wanted: "4.19.0", latest: "5.0.0" },
    });

    mockExecSync.mockReturnValue(outdatedJson);

    const result = await getOutdated();

    expect(result.packages[0].name).toBe("express");
    expect(result.packages[1].name).toBe("lodash");
  });
});
