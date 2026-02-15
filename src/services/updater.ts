import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { UpdateResult } from "../utils/types.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readPackageJson(): PackageJson {
  const pkgPath = resolve(process.cwd(), "package.json");
  return JSON.parse(readFileSync(pkgPath, "utf-8"));
}

function getCurrentVersion(name: string): string {
  const pkg = readPackageJson();
  return pkg.dependencies?.[name] ?? pkg.devDependencies?.[name] ?? "unknown";
}

function isDevDep(name: string): boolean {
  const pkg = readPackageJson();
  return name in (pkg.devDependencies ?? {});
}

export function extractErrorReason(stderr: string): string {
  // Look for ERESOLVE (peer dependency conflict)
  if (stderr.includes("ERESOLVE")) {
    return "Peer dependency conflict (use --force to bypass)";
  }
  // Look for 404 / not found
  if (stderr.includes("404") || stderr.includes("Not Found")) {
    return "Package not found in registry";
  }
  // Look for permission errors
  if (stderr.includes("EACCES")) {
    return "Permission denied";
  }
  // Look for network errors
  if (stderr.includes("ETIMEDOUT") || stderr.includes("ENOTFOUND")) {
    return "Network error";
  }
  // Generic: grab the first npm ERR! line
  const errLine = stderr
    .split("\n")
    .find((line) => line.includes("npm ERR!") || line.includes("npm error"));
  if (errLine) {
    return errLine.replace(/npm (ERR!|error)\s*/, "").trim();
  }
  return "Unknown error";
}

export interface UpdateOptions {
  exact: boolean;
  force: boolean;
}

export async function updatePackage(
  name: string,
  options: UpdateOptions
): Promise<UpdateResult> {
  const previousVersion = getCurrentVersion(name);

  try {
    const saveFlag = isDevDep(name) ? "--save-dev" : "--save";
    const exactFlag = options.exact ? "--save-exact" : "";
    const forceFlag = options.force ? "--legacy-peer-deps" : "";

    const cmd = `npm install ${name}@latest ${saveFlag} ${exactFlag} ${forceFlag}`.trim();

    execSync(cmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const newVersion = getCurrentVersion(name);

    return {
      name,
      previousVersion,
      newVersion,
      success: true,
    };
  } catch (err: unknown) {
    const execErr = err as { stderr?: string; message?: string };
    const reason = execErr.stderr
      ? extractErrorReason(execErr.stderr)
      : (execErr.message?.split("\n")[0] ?? "Unknown error");

    return {
      name,
      previousVersion,
      newVersion: previousVersion,
      success: false,
      error: reason,
    };
  }
}

export async function updateMultiplePackages(
  names: string[],
  options: UpdateOptions,
  onProgress?: (result: UpdateResult, index: number, total: number) => void
): Promise<UpdateResult[]> {
  const results: UpdateResult[] = [];

  for (let i = 0; i < names.length; i++) {
    const result = await updatePackage(names[i], options);
    results.push(result);
    onProgress?.(result, i, names.length);
  }

  return results;
}
