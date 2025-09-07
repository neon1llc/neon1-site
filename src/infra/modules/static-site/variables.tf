/*
    neon1-site :: infra/modules/static-site/variables.tf
    Purpose: Input variables for the static-site module (S3 + CloudFront + ACM).
    These are set by each environment (dev/staging/prod) in their root modules.
*/

# Global project identifier (keeps resource names consistent across modules)
variable "project" {
  type    = string
  default = "neon1-site"
}

# Environment slug (e.g., dev, staging, prod)
variable "env" {
  type = string
}

# AWS region for the main resources (S3 + CloudFront distribution config)
variable "region" {
  type    = string
  default = "us-east-1"
}

# Base domain name (e.g., neon1.tech)
# Used with subdomain to generate the full hostname
variable "base_domain" {
  type = string
}

# Subdomain for this environment (e.g., dev.neon1.tech, staging.neon1.tech, www.neon1.tech)
variable "subdomain" {
  type    = string
  default = null
}

# Whether to create Route53 records automatically
# If false, certificate DNS validation and alias records must be handled manually
variable "create_route53_records" {
  type    = bool
  default = true
}

# Explicit Route53 zone ID (if you don’t want auto-lookup by base_domain)
variable "zone_id" {
  type    = string
  default = null
}

# CloudFront price class (controls edge location spread / cost)
# Common values: PriceClass_100 (US+EU), PriceClass_200 (US+EU+Asia), All
variable "price_class" {
  type    = string
  default = "PriceClass_100"
}

# Whether to enable CloudFront logging
# Defaults to false to avoid ACL headaches unless a dedicated log bucket is set
variable "enable_logging" {
  type    = bool
  default = false
}

# Optional: bucket name for CloudFront logs (if logging enabled)
variable "log_bucket_name" {
  type    = string
  default = null
}

# SPA (single-page app) rewrite support
# If true, CloudFront returns index.html for 403/404 errors
variable "spa_rewrite" {
  type    = bool
  default = true
}

# Tags applied to all resources (for cost/accountability tracking)
variable "tags" {
  type    = map(string)
  default = {}
}
