import { loadEnv } from "vite";
import {
  aws,
  checkAccount,
  config,
  root,
  run,
  terraform,
} from "./aws-common.mjs";

try {
  checkAccount();
  const env = { ...loadEnv("production", root, "VITE_"), ...process.env };
  for (const name of ["API_KEY", "AUTH_DOMAIN", "PROJECT_ID", "APP_ID"]) {
    if (!env[`VITE_FIREBASE_${name}`])
      throw new Error(
        `Missing VITE_FIREBASE_${name}. Populate .env.local before deployment.`,
      );
  }
  if (
    env.VITE_FIREBASE_EMULATORS === "true" ||
    env.VITE_FIREBASE_PROJECT_ID.startsWith("demo-")
  ) {
    throw new Error("Refusing to deploy an emulator configuration.");
  }
  const outputs = JSON.parse(
    run(terraform, ["-chdir=infra", "output", "-json"], { capture: true }),
  );
  if (
    outputs.aws_account_id?.value !== config.aws_account_id ||
    outputs.site_bucket?.value !== config.site_bucket
  ) {
    throw new Error(
      "Terraform outputs do not match infra/deployment.json. Initialize and apply the correct state first.",
    );
  }
  const distribution = outputs.distribution_id.value;
  run("npm", ["run", "build"]);
  const destination = `s3://${outputs.site_bucket.value}`;
  // Keep old hashed assets so an already open tab can finish using its release.
  // Publish dependencies first, then the catalog, and finally the entry point.
  aws([
    "s3",
    "sync",
    "dist/",
    `${destination}/`,
    "--no-follow-symlinks",
    "--exclude",
    "*",
    "--include",
    "assets/*",
    "--include",
    "recordings/audio/*",
    "--cache-control",
    "public,max-age=31536000,immutable",
    "--only-show-errors",
  ]);
  aws([
    "s3",
    "sync",
    "dist/",
    `${destination}/`,
    "--no-follow-symlinks",
    "--exclude",
    "assets/*",
    "--exclude",
    "recordings/audio/*",
    "--exclude",
    "recordings/catalog.json",
    "--exclude",
    "index.html",
    "--cache-control",
    "public,max-age=300",
    "--only-show-errors",
  ]);
  aws([
    "s3",
    "cp",
    "dist/recordings/catalog.json",
    `${destination}/recordings/catalog.json`,
    "--content-type",
    "application/json",
    "--cache-control",
    "no-cache,max-age=0,must-revalidate",
    "--only-show-errors",
  ]);
  aws([
    "s3",
    "cp",
    "dist/index.html",
    `${destination}/index.html`,
    "--content-type",
    "text/html; charset=utf-8",
    "--cache-control",
    "no-cache,max-age=0,must-revalidate",
    "--only-show-errors",
  ]);
  const invalidation = JSON.parse(
    aws(
      [
        "cloudfront",
        "create-invalidation",
        "--distribution-id",
        distribution,
        "--paths",
        "/*",
        "--output",
        "json",
      ],
      { capture: true },
    ),
  );
  console.log(
    `Waiting for CloudFront invalidation ${invalidation.Invalidation.Id}…`,
  );
  aws([
    "cloudfront",
    "wait",
    "invalidation-completed",
    "--distribution-id",
    distribution,
    "--id",
    invalidation.Invalidation.Id,
  ]);
  console.log(`Deployed ${outputs.site_url.value}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
