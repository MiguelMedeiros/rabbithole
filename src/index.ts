#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Command } from "commander";
import { scanCommand } from "./commands/scan.js";
import { updateCommand } from "./commands/update.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf-8"));

const program = new Command();

program.name("rabbithole").description(pkg.description).version(pkg.version);

program
  .command("scan")
  .description(
    "Scan dependencies for vulnerabilities, outdated, deprecated, and stale packages"
  )
  .action(async () => {
    await scanCommand();
  });

program
  .command("update")
  .description("Update outdated packages (interactive by default)")
  .argument("[packages...]", "specific packages to update")
  .option("-a, --all", "update all outdated packages")
  .option("--exact", "save exact versions (default: true)", true)
  .option("--no-exact", "save with caret range instead of exact versions")
  .option(
    "-f, --force",
    "force install ignoring peer dependency conflicts (--legacy-peer-deps)"
  )
  .option("--fix", "run npm audit fix after updating to resolve vulnerabilities")
  .action(
    async (
      packages: string[],
      options: { all?: boolean; exact?: boolean; force?: boolean; fix?: boolean }
    ) => {
      await updateCommand(packages, options);
    }
  );

program.parse();
