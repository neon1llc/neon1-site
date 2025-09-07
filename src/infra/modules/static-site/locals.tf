/*
    neon1-site :: infra/modules/static-site/locals.tf
    Purpose: Local computed values used across this module.
    These make domain/bucket naming consistent and easy to reuse.
*/

locals {
  # Full domain name served by CloudFront + ACM
  # If no subdomain is provided → use just the base_domain (e.g., neon1.tech)
  # Else → prepend the subdomain (e.g., dev.neon1.tech)
  full_domain = (
    var.subdomain == null || var.subdomain == ""
  ) ? var.base_domain : "${var.subdomain}.${var.base_domain}"

  # Prefix used for S3 bucket naming (keeps names consistent across envs)
  # Example result: neon1-site-dev-site
  bucket_prefix = "${var.project}-${var.env}-site"
}
