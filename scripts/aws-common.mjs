import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const config = JSON.parse(
  readFileSync(new URL("../infra/deployment.json", import.meta.url)),
);
export const terraform = process.env.TERRAFORM_BIN || "terraform";

export function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    env: { ...process.env, AWS_PAGER: "" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} failed (exit ${result.status}).`);
  return capture ? result.stdout.trim() : undefined;
}

export function aws(args, options) {
  return run(
    "aws",
    ["--profile", config.aws_profile, "--region", config.aws_region, ...args],
    options,
  );
}

export function checkAccount() {
  const account = aws(
    ["sts", "get-caller-identity", "--query", "Account", "--output", "text"],
    { capture: true },
  );
  if (account !== config.aws_account_id)
    throw new Error(
      `Expected AWS account ${config.aws_account_id}; got ${account}.`,
    );
  console.log(`Using AWS profile ${config.aws_profile}, account ${account}.`);
}
