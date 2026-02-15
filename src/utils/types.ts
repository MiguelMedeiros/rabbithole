// ── Vulnerability types (from npm audit --json) ──

export type SeverityLevel = "critical" | "high" | "moderate" | "low" | "info";

export interface Vulnerability {
  name: string;
  severity: SeverityLevel;
  title: string;
  url: string;
  range: string;
  fixAvailable: boolean | { name: string; version: string };
}

export interface AuditResult {
  vulnerabilities: Vulnerability[];
  summary: Record<SeverityLevel, number>;
  total: number;
}

// ── Outdated types (from npm outdated --json) ──

export interface OutdatedPackage {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  location: string;
  type: "dependencies" | "devDependencies";
}

export interface OutdatedResult {
  packages: OutdatedPackage[];
  total: number;
}

// ── Registry metadata types ──

export interface RegistryMetadata {
  name: string;
  deprecated: string | false;
  lastPublishDate: string;
  lastPublishAge: string;
  isStale: boolean; // no update in 2+ years
}

// ── Scan report ──

export interface ScanReport {
  audit: AuditResult;
  outdated: OutdatedResult;
  deprecated: RegistryMetadata[];
  stale: RegistryMetadata[];
}

// ── Update types ──

export interface UpdateResult {
  name: string;
  previousVersion: string;
  newVersion: string;
  success: boolean;
  error?: string;
}

// ── Audit fix types ──

export interface AuditFixResult {
  success: boolean;
  added: number;
  removed: number;
  changed: number;
  fixedVulnerabilities: number;
  remainingVulnerabilities: number;
  error?: string;
}
