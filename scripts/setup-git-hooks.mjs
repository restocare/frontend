// Point git at the repo's hooks (.githooks/pre-commit runs eslint on staged
// files). Runs from the `prepare` npm script; skipped outside a git checkout
// (e.g. a Vercel build) so it can never fail an install.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".git")) {
  try {
    execSync("git config core.hooksPath .githooks", { stdio: "ignore" });
  } catch {
    // git missing or not writable: hooks stay optional.
  }
}
