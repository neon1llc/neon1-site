
/*
  neon1-site :: infra/modules/neo-chat/variables.tf
  Purpose: Inputs for the Neo chat backend module (Lambda + API + optional DynamoDB).
  Related: infra/modules/neo-chat/main.tf, outputs.tf, lambda/index.py
*/

# Used to name resources
variable "project" {
  type    = string
  default = "neon1-site"
}

# Environment slug: dev|staging|prod
variable "env" {
  type = string
}

# Lambda+API region (Bedrock is region-bound)
variable "region" {
  type    = string
  default = "us-east-1"
}

# Toggle DynamoDB memory persistence
variable "enable_memory" {
  type    = bool
  default = true
}

# How many recent messages to round-trip
variable "memory_max_messages" {
  type    = number
  default = 10
}

# Bedrock model id
variable "model_id" {
  type    = string
  default = "anthropic.claude-3-haiku-20240307-v1:0"
}

# Persona baked-in (Neo)
variable "system_prompt" {
  type    = string
  default = "You are Neo from The Matrix. Calm, kind, a quiet rebel. Speak briefly, clearly, and compassionately. Help the user escape confusion."
}

# CORS allowlist
variable "allowed_origins" {
  type    = list(string)
  default = []
}

# CloudWatch Logs retention
variable "log_retention_days" {
  type    = number
  default = 14
}

# Max requests per session per day (default = 1000)
variable "max_requests_per_day" {
  type    = number
  default = 1000
}

# Tag everything
variable "tags" {
  type    = map(string)
  default = {}
}
