output "site_url" {
  value = "https://${local.deployment.domain_name}"
}

output "site_bucket" {
  value = aws_s3_bucket.site.id
}

output "distribution_id" {
  value = aws_cloudfront_distribution.site.id
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.site.domain_name
}

output "aws_account_id" {
  value = local.deployment.aws_account_id
}

output "aws_region" {
  value = local.deployment.aws_region
}
