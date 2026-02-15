import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { OutdatedPackage, OutdatedResult } from "../utils/types.js";

export async function getOutdated(): Promise<OutdatedResult> {
  try {
    // Read package.json to determine dep type
    const pkgPath = resolve(process.cwd(), "package.json");
    const pkgJson = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const devDeps = new Set(Object.keys(pkgJson.devDependencies ?? {}));

    // npm outdated exits with code 1 when outdated packages exist
    let stdout: string;
    try {
      stdout = execSync("npm outdated --json", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err: unknown) {
      const execErr = err as { stdout?: string };
      if (execErr.stdout) {
        stdout = execErr.stdout;
      } else {
        return { packages: [], total: 0 };
      }
    }

    const data = JSON.parse(stdout);

    if (!data || Object.keys(data).length === 0) {
      return { packages: [], total: 0 };
    }

    const packages: OutdatedPackage[] = [];

    for (const [name, info] of Object.entries(data)) {
      const pkg = info as {
        current?: string;
        wanted: string;
        latest: string;
        location?: string;
      };

      packages.push({
        name,
        current: pkg.current ?? "MISSING",
        wanted: pkg.wanted,
        latest: pkg.latest,
        location: pkg.location ?? "",
        type: devDeps.has(name) ? "devDependencies" : "dependencies",
      });
    }

    // Sort: dependencies first, then by name
    packages.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "dependencies" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      packages,
      total: packages.length,
    };
  } catch {
    return { packages: [], total: 0 };
  }
}
