import type { RegistryMetadata } from "../utils/types.js";

const STALE_THRESHOLD_MS = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years

export function formatAge(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 30) return `${days} days ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) return `${years} year${years > 1 ? "s" : ""} ago`;
  return `${years}y ${remainingMonths}m ago`;
}

export async function getPackageMetadata(
  packageName: string
): Promise<RegistryMetadata | null> {
  try {
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}`
    );

    if (!response.ok) return null;

    const data = (await response.json()) as {
      name: string;
      "dist-tags"?: { latest?: string };
      time?: Record<string, string>;
      versions?: Record<string, { deprecated?: string }>;
    };

    const latestVersion = data["dist-tags"]?.latest;
    const timeMap = data.time ?? {};

    // Get last publish date
    const lastPublishDate = latestVersion
      ? (timeMap[latestVersion] ?? timeMap.modified ?? "")
      : (timeMap.modified ?? "");

    const isStale =
      lastPublishDate !== "" &&
      Date.now() - new Date(lastPublishDate).getTime() > STALE_THRESHOLD_MS;

    // Check if latest version is deprecated
    let deprecated: string | false = false;
    if (latestVersion && data.versions?.[latestVersion]?.deprecated) {
      deprecated = data.versions[latestVersion].deprecated as string;
    }

    return {
      name: packageName,
      deprecated,
      lastPublishDate,
      lastPublishAge: lastPublishDate ? formatAge(lastPublishDate) : "unknown",
      isStale,
    };
  } catch {
    return null;
  }
}

export async function getMultiplePackageMetadata(
  packageNames: string[]
): Promise<RegistryMetadata[]> {
  // Fetch in batches of 10 to avoid overwhelming the registry
  const batchSize = 10;
  const results: RegistryMetadata[] = [];

  for (let i = 0; i < packageNames.length; i += batchSize) {
    const batch = packageNames.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((name) => getPackageMetadata(name)));
    results.push(...batchResults.filter((r): r is RegistryMetadata => r !== null));
  }

  return results;
}
