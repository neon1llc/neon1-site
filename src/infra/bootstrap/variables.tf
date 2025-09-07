
/*
  neon1-site :: infra/bootstrap/variables.tf
  Purpose: Variables for S3+DynamoDB backend bootstrap.
*/
variable "project" { type = string, default = "neon1-site" }
variable "region"  { type = string, default = "us-east-1" }
