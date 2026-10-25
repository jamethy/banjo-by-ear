import { writeFileSync } from "node:fs";
import {
  aws,
  checkAccount,
  config,
  root,
  run,
  terraform,
} from "./aws-common.mjs";

try {
  run(terraform, ["version"], { capture: true });
  checkAccount();
  const buckets = JSON.parse(
    aws(
      [
        "s3api",
        "list-buckets",
        "--query",
        "Buckets[].Name",
        "--output",
        "json",
      ],
      { capture: true },
    ),
  );
  if (!buckets.includes(config.state_bucket)) {
    const args = ["s3api", "create-bucket", "--bucket", config.state_bucket];
    if (config.aws_region !== "us-east-1")
      args.push(
        "--create-bucket-configuration",
        `LocationConstraint=${config.aws_region}`,
      );
    aws(args);
  }
  const bucketArgs = [
    "--bucket",
    config.state_bucket,
    "--expected-bucket-owner",
    config.aws_account_id,
  ];
  aws([
    "s3api",
    "put-public-access-block",
    ...bucketArgs,
    "--public-access-block-configuration",
    JSON.stringify({
      BlockPublicAcls: true,
      IgnorePublicAcls: true,
      BlockPublicPolicy: true,
      RestrictPublicBuckets: true,
    }),
  ]);
  aws([
    "s3api",
    "put-bucket-encryption",
    ...bucketArgs,
    "--server-side-encryption-configuration",
    JSON.stringify({
      Rules: [
        { ApplyServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } },
      ],
    }),
  ]);
  aws([
    "s3api",
    "put-bucket-versioning",
    ...bucketArgs,
    "--versioning-configuration",
    "Status=Enabled",
  ]);
  const backend = {
    bucket: config.state_bucket,
    key: "production/terraform.tfstate",
    region: config.aws_region,
    profile: config.aws_profile,
    allowed_account_ids: [config.aws_account_id],
    encrypt: true,
    use_lockfile: true,
  };
  writeFileSync(
    `${root}infra/backend.hcl`,
    Object.entries(backend)
      .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
      .join("\n") + "\n",
  );
  run(terraform, [
    "-chdir=infra",
    "init",
    "-input=false",
    "-backend-config=backend.hcl",
  ]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
