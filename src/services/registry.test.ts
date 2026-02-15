import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatAge, getPackageMetadata, getMultiplePackageMetadata } from "./registry.js";

describe("formatAge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-15T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return days ago for recent dates", () => {
    expect(formatAge("2026-02-10T00:00:00Z")).toBe("5 days ago");
  });

  it("should return 0 days ago for today", () => {
    expect(formatAge("2026-02-15T00:00:00Z")).toBe("0 days ago");
  });

  it("should return months ago for dates within a year", () => {
    expect(formatAge("2025-11-15T00:00:00Z")).toBe("3 months ago");
  });

  it("should return singular month", () => {
    expect(formatAge("2026-01-10T00:00:00Z")).toBe("1 month ago");
  });

  it("should return years ago for old dates", () => {
    expect(formatAge("2024-02-15T00:00:00Z")).toBe("2 years ago");
  });

  it("should return years and months for mixed dates", () => {
    expect(formatAge("2023-08-15T00:00:00Z")).toBe("2y 6m ago");
  });

  it("should return singular year", () => {
    expect(formatAge("2025-02-15T00:00:00Z")).toBe("1 year ago");
  });
});

describe("getPackageMetadata", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-15T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should return metadata for a valid package", async () => {
    const mockData = {
      name: "test-pkg",
      "dist-tags": { latest: "2.0.0" },
      time: {
        "2.0.0": "2026-01-01T00:00:00Z",
        modified: "2026-01-01T00:00:00Z",
      },
      versions: {
        "2.0.0": {},
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      })
    );

    const result = await getPackageMetadata("test-pkg");

    expect(result).not.toBeNull();
    expect(result!.name).toBe("test-pkg");
    expect(result!.deprecated).toBe(false);
    expect(result!.isStale).toBe(false);
    expect(result!.lastPublishDate).toBe("2026-01-01T00:00:00Z");
  });

  it("should detect deprecated packages", async () => {
    const mockData = {
      name: "old-pkg",
      "dist-tags": { latest: "1.0.0" },
      time: { "1.0.0": "2020-01-01T00:00:00Z" },
      versions: {
        "1.0.0": { deprecated: "Use new-pkg instead" },
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      })
    );

    const result = await getPackageMetadata("old-pkg");

    expect(result!.deprecated).toBe("Use new-pkg instead");
  });

  it("should detect stale packages (>2 years old)", async () => {
    const mockData = {
      name: "stale-pkg",
      "dist-tags": { latest: "1.0.0" },
      time: { "1.0.0": "2023-01-01T00:00:00Z" },
      versions: { "1.0.0": {} },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      })
    );

    const result = await getPackageMetadata("stale-pkg");

    expect(result!.isStale).toBe(true);
  });

  it("should return null for non-existent packages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const result = await getPackageMetadata("nonexistent-pkg-xyz");
    expect(result).toBeNull();
  });

  it("should return null on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const result = await getPackageMetadata("some-pkg");
    expect(result).toBeNull();
  });

  it("should handle missing dist-tags gracefully", async () => {
    const mockData = {
      name: "weird-pkg",
      time: { modified: "2025-06-01T00:00:00Z" },
      versions: {},
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      })
    );

    const result = await getPackageMetadata("weird-pkg");

    expect(result).not.toBeNull();
    expect(result!.lastPublishDate).toBe("2025-06-01T00:00:00Z");
    expect(result!.deprecated).toBe(false);
  });
});

describe("getMultiplePackageMetadata", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should fetch metadata for multiple packages", async () => {
    const makeMock = (name: string) => ({
      name,
      "dist-tags": { latest: "1.0.0" },
      time: { "1.0.0": "2026-01-01T00:00:00Z" },
      versions: { "1.0.0": {} },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        const name = (url as string).split("/").pop()!;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(makeMock(name)),
        });
      })
    );

    const results = await getMultiplePackageMetadata(["pkg-a", "pkg-b", "pkg-c"]);

    expect(results).toHaveLength(3);
    expect(results.map((r) => r.name)).toEqual(["pkg-a", "pkg-b", "pkg-c"]);
  });

  it("should filter out null results (failed fetches)", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.resolve({ ok: false, status: 404 });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              name: `pkg-${callCount}`,
              "dist-tags": { latest: "1.0.0" },
              time: { "1.0.0": "2026-01-01T00:00:00Z" },
              versions: { "1.0.0": {} },
            }),
        });
      })
    );

    const results = await getMultiplePackageMetadata(["a", "b", "c"]);
    expect(results).toHaveLength(2);
  });

  it("should return empty array for empty input", async () => {
    const results = await getMultiplePackageMetadata([]);
    expect(results).toEqual([]);
  });
});
