# infra:init creates this bucket before initializing the backend. Importing it
# makes its protections reviewable and maintained by Terraform thereafter.
import {
  to = aws_s3_bucket.state
  id = local.deployment.state_bucket
}

import {
  to = aws_s3_bucket_versioning.state
  id = local.deployment.state_bucket
}

import {
  to = aws_s3_bucket_server_side_encryption_configuration.state
  id = local.deployment.state_bucket
}

import {
  to = aws_s3_bucket_public_access_block.state
  id = local.deployment.state_bucket
}

resource "aws_s3_bucket" "state" {
  bucket = local.deployment.state_bucket

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}
