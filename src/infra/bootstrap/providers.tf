
/*
  neon1-site :: infra/bootstrap/providers.tf
  Purpose: Provider pinning for bootstrap stack.
*/
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws    = { source = "hashicorp/aws", version = ">= 5.0" }
    random = { source = "hashicorp/random", version = ">= 3.5" }
  }
}
provider "aws" { region = var.region }
