
# neon1-site :: staging.tfvars — set your domain here
project   = "neon1-site"
env       = "staging"
region    = "us-east-1"
base_domain = "neon1.tech"
subdomain   = "staging"
create_route53_records = true
price_class = "PriceClass_100"
enable_logging = false
spa_rewrite = true
tags = {
  Project = "neon1"
  Environment = "staging"
}
