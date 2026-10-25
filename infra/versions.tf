terraform {
  required_version = ">= 1.10, < 2.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {}
}

locals {
  deployment = jsondecode(file("${path.module}/deployment.json"))
}

provider "aws" {
  region              = local.deployment.aws_region
  profile             = local.deployment.aws_profile
  allowed_account_ids = [local.deployment.aws_account_id]

  default_tags {
    tags = {
      Project   = "learn-banjo"
      ManagedBy = "Terraform"
    }
  }
}
