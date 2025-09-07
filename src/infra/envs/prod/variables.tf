
/*
  neon1-site :: infra/envs/prod/variables.tf
  Purpose: Root variables per environment.
*/
variable "project" { type = string, default = "neon1-site" }
variable "env"     { type = string, default = "prod" }
variable "region"  { type = string, default = "us-east-1" }
variable "base_domain" { type = string, default = "neon1.tech" }
variable "subdomain"   { type = string, default = "www" }
variable "create_route53_records" { type = bool, default = true }
variable "zone_id" { type = string, default = null }
variable "price_class" { type = string, default = "PriceClass_100" }
variable "enable_logging" { type = bool, default = false }
variable "log_bucket_name" { type = string, default = null }
variable "spa_rewrite" { type = bool, default = true }
variable "tags" { type = map(string), default = {} }
