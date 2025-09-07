terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.5"
    }
  }
}

# Needed for ACM cert in us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

resource "random_id" "suffix" {
  byte_length = 3
}

# --------------------------
# S3 bucket for static site
# --------------------------
resource "aws_s3_bucket" "site" {
  bucket = "${var.project}-${var.env}-site-${random_id.suffix.hex}"
  tags   = merge(var.tags, { Environment = var.env })
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# --------------------------
# CloudFront + ACM
# --------------------------
resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "${var.project}-${var.env}-oai"
}

resource "aws_acm_certificate" "cert" {
  provider          = aws.us_east_1
  domain_name       = local.full_domain
  validation_method = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = var.price_class

  origin {
    domain_name = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id   = "s3-site"
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-site"
    viewer_protocol_policy = "redirect-to-https"
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.cert.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # ✅ Required restrictions block
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}


# --------------------------
# Route53 Aliases
# --------------------------
data "aws_route53_zone" "this" {
  count        = var.zone_id == null && var.create_route53_records ? 1 : 0
  name         = "${var.base_domain}."
  private_zone = false
}

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
