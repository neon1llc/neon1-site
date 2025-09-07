/*
    neon1-site :: infra/modules/static-site/outputs.tf
    Purpose: Exported values from the static-site module.
    These are consumed by env root modules and the CI/CD pipeline.
*/

# S3 bucket name holding the site files
# Used by GitHub Actions to run `aws s3 sync dist s3://<bucket>`
output "bucket_name" {
  value = aws_s3_bucket.site.bucket
}

# CloudFront distribution ID
# Needed for cache invalidations after deployments
output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.cdn.id
}

# CloudFront domain name (e.g., d123abc.cloudfront.net)
# Can be useful for debugging or fallback testing
output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.cdn.domain_name
}

# Full domain name (e.g., dev.neon1.tech, staging.neon1.tech, www.neon1.tech)
# This is what you actually visit in the browser
output "full_domain_name" {
  value = local.full_domain
}
