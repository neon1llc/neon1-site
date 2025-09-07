/*
    neon1-site :: infra/modules/static-site/main.tf
    Purpose: Private S3 bucket + CloudFront + ACM (DNS validated) + optional Route53 aliases.
    Related: variables.tf (inputs), outputs.tf (exported values).
*/

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0" # Up-to-date AWS provider
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.5" # For bucket suffixes to avoid collisions
    }
  }
}

# Secondary provider for us-east-1 (mandatory for CloudFront ACM certificates)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# Random suffix to keep bucket names globally unique
resource "random_id" "suffix" {
  byte_length = 3
}

# -------------------------------
# S3 bucket (private) for site content
# -------------------------------
resource "aws_s3_bucket" "site" {
  bucket = "${local.bucket_prefix}-${random_id.suffix.hex}"
  tags = merge(var.tags, {
    Name        = "${var.project}-${var.env}-site"
    Environment = var.env
  })
}

# Block all public access on the site bucket
resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enforce bucket owner for all uploaded objects (avoids ACL issues)
resource "aws_s3_bucket_ownership_controls" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# Default SSE encryption at rest (AES-256)
resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# -------------------------------
# CloudFront OAI (Origin Access Identity)
# Allows CloudFront to read from the S3 bucket privately
# -------------------------------
resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "${var.project}-${var.env}-oai"
}

# Bucket policy granting CloudFront OAI read-only access
data "aws_iam_policy_document" "site_policy" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]
    principals {
      type        = "CanonicalUser"
      identifiers = [aws_cloudfront_origin_access_identity.oai.s3_canonical_user_id]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.site_policy.json
}

# -------------------------------
# DNS + Certificate for CloudFront
# -------------------------------

# Lookup Route53 zone (if not provided explicitly)
data "aws_route53_zone" "this" {
  count        = var.create_route53_records && var.zone_id == null ? 1 : 0
  name         = "${var.base_domain}."
  private_zone = false
}

# ACM certificate (must be in us-east-1 for CloudFront)
resource "aws_acm_certificate" "cert" {
  provider          = aws.us_east_1
  domain_name       = local.full_domain
  validation_method = "DNS"
  lifecycle {
    create_before_destroy = true # avoids downtime
  }
  tags = merge(var.tags, { Environment = var.env })
}

# DNS validation records for ACM certificate
resource "aws_route53_record" "cert_validation" {
  for_each = var.create_route53_records ? {
    for dvo in aws_acm_certificate.cert.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  } : {}

  zone_id = var.zone_id != null ? var.zone_id : data.aws_route53_zone.this[0].zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.value]
}

# Validate ACM cert after DNS records propagate
resource "aws_acm_certificate_validation" "cert" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.cert.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# -------------------------------
# CloudFront distribution
# -------------------------------
resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  is_ipv6_enabled     = true
  price_class         = var.price_class
  default_root_object = "index.html"

  origin {
    domain_name = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id   = "s3-site-origin"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-site-origin"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  # TLS configuration
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.cert.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # Single-page app fallback: map 403/404 → index.html
  dynamic "custom_error_response" {
    for_each = var.spa_rewrite ? [1, 2] : []
    content {
      error_code            = custom_error_response.value == 1 ? 404 : 403
      response_code         = 200
      response_page_path    = "/index.html"
      error_caching_min_ttl = 0
    }
  }

  # Optional logging → another S3 bucket
  dynamic "logging_config" {
    for_each = var.enable_logging ? [1] : []
    content {
      bucket          = var.log_bucket_name != null ? "${var.log_bucket_name}.s3.amazonaws.com" : null
      include_cookies = false
      prefix          = var.env
    }
  }

  # No geo restriction by default
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = merge(var.tags, { Environment = var.env })
}

# -------------------------------
# Route53 records for CloudFront alias
# -------------------------------
resource "aws_route53_record" "alias_a" {
  count   = var.create_route53_records ? 1 : 0
  zone_id = var.zone_id != null ? var.zone_id : data.aws_route53_zone.this[0].zone_id
  name    = local.full_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.cdn.domain_name
    zone_id                = aws_cloudfront_distribution.cdn.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "alias_aaaa" {
  count   = var.create_route53_records ? 1 : 0
  zone_id = var.zone_id != null ? var.zone_id : data.aws_route53_zone.this[0].zone_id
  name    = local.full_domain
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.cdn.domain_name
    zone_id                = aws_cloudfront_distribution.cdn.hosted_zone_id
    evaluate_target_health = false
  }
}
