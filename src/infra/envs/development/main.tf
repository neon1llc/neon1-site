
/*
  neon1-site :: infra/envs/dev/main.tf
  Purpose: Env root — wires static site + neo chat modules.
*/
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws     = { source = "hashicorp/aws", version = ">= 5.0" }
    random  = { source = "hashicorp/random", version = ">= 3.5" }
    archive = { source = "hashicorp/archive", version = ">= 2.4" }
  }
  backend "s3" {} # Configured via backend.hcl
}

provider "aws" { region = var.region }
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

module "site" {
  source = "../../modules/static-site"

  project = var.project
  env     = var.env
  region  = var.region

  base_domain            = var.base_domain
  subdomain              = var.subdomain
  create_route53_records = var.create_route53_records
  zone_id                = var.zone_id
  price_class            = var.price_class
  enable_logging         = var.enable_logging
  log_bucket_name        = var.log_bucket_name
  spa_rewrite            = var.spa_rewrite
  tags                   = var.tags
}

# Neo chat backend — allow the CloudFront domain
module "neo_chat" {
  source = "../../modules/neo-chat"

  project = var.project
  env     = var.env
  region  = var.region

  allowed_origins = [
    "https://${module.site.full_domain_name}",
    # nice for local dev
    "http://localhost:5173",
    "http://localhost:3000"
  ]

  # Defaults are fine; override here if you want different behavior
  # model_id      = "anthropic.claude-3-haiku-20240307-v1:0"
  # enable_memory = true
  # memory_max_messages = 10

  tags = var.tags
}

# Outputs consumed by CI
output "bucket_name" { value = module.site.bucket_name }
output "cloudfront_distribution_id" { value = module.site.cloudfront_distribution_id }
output "cloudfront_domain_name" { value = module.site.cloudfront_domain_name }
output "full_domain_name" { value = module.site.full_domain_name }
output "neo_chat_api_url" { value = module.neo_chat.api_url }
