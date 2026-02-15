#!/usr/bin/env node

import { Command } from "commander";
import { scanCommand } from "./commands/scan.js";
import { updateCommand } from "./commands/update.js";

const program = new Command();

program
  .name("rabbithole")
  .description("How deep does your dependency tree go? — Dependency health check CLI")
  .version("1.0.0");

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
