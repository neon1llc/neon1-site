/*
  neon1-site :: infra/modules/neo-chat/main.tf
  Purpose: Provision the Neo chat backend on AWS (Lambda + API + optional DynamoDB).
  Related: variables.tf, outputs.tf, lambda/index.py
*/

terraform {
  required_providers {
    aws     = { source = "hashicorp/aws", version = ">= 5.0" }     # AWS provider up-to-date
    archive = { source = "hashicorp/archive", version = ">= 2.4" } # Needed for packaging Lambda code
  }
}

locals {
  # Common naming prefixes (keeps things unique per project/env)
  name_prefix = "${var.project}-${var.env}-neo"
  table_name  = "${var.project}-${var.env}-neo-messages"
  lambda_name = "${var.project}-${var.env}-neo-handler"
  api_name    = "${var.project}-${var.env}-neo-api"
  stage_name  = "v1"

  # Allowed CORS origins (fallback to "*" if not provided)
  cors_origins = length(var.allowed_origins) > 0 ? var.allowed_origins : ["*"]
}

# -------------------------------
# Package the Lambda code into zip
# -------------------------------
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda" # Folder with index.py
  output_path = "${path.module}/.build/${local.lambda_name}.zip"
}

# -------------------------------
# IAM Role for Lambda
# -------------------------------
resource "aws_iam_role" "lambda_role" {
  name = "${local.lambda_name}-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" } # Only Lambda can assume this role
      Action    = "sts:AssumeRole"
    }]
  })
  tags = merge(var.tags, { "Name" = "${local.lambda_name}-role" })
}

# Attach AWS-managed basic Lambda logging policy
resource "aws_iam_role_policy_attachment" "lambda_basic_logging" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# -------------------------------
# IAM Policy for Bedrock access
# -------------------------------
resource "aws_iam_policy" "bedrock_invoke" {
  name = "${local.lambda_name}-bedrock"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect   = "Allow"
      Action   = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"] # Full invoke
      Resource = "*"                                                              # Could be restricted if needed
    }]
  })
}

# Attach Bedrock invoke policy to Lambda role
resource "aws_iam_role_policy_attachment" "attach_bedrock" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.bedrock_invoke.arn
}

# -------------------------------
# DynamoDB (optional memory store)
# -------------------------------
resource "aws_dynamodb_table" "memory" {
  count        = var.enable_memory ? 1 : 0
  name         = local.table_name
  billing_mode = "PAY_PER_REQUEST" # Scales with use, no capacity planning
  hash_key     = "session_id"
  range_key    = "ts"

  # Keys: session_id (partition), ts (sort)
  attribute {
    name = "session_id"
    type = "S"
  }
  attribute {
    name = "ts"
    type = "N"
  }

  tags = merge(var.tags, { "Name" = local.table_name, "Environment" = var.env })
}

# IAM policy granting Lambda access to the memory table
resource "aws_iam_policy" "dynamo_access" {
  count = var.enable_memory ? 1 : 0
  name  = "${local.lambda_name}-ddb"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:Query",
        "dynamodb:UpdateItem", "dynamodb:BatchWriteItem", "dynamodb:DescribeTable"
      ]
      Resource = [aws_dynamodb_table.memory[0].arn]
    }]
  })
}

# Attach DDB access policy if memory is enabled
resource "aws_iam_role_policy_attachment" "attach_ddb" {
  count      = var.enable_memory ? 1 : 0
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.dynamo_access[0].arn
}

# -------------------------------
# CloudWatch Logs
# -------------------------------
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.lambda_name}" # Log group name matches function
  retention_in_days = var.log_retention_days             # Configurable retention
}

# -------------------------------
# Lambda Function (Python 3.12)
# -------------------------------
resource "aws_lambda_function" "neo" {
  function_name    = local.lambda_name
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler" # index.py handler
  runtime          = "python3.12"    # 2025 recommended runtime
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 20  # seconds
  memory_size      = 256 # MB

  environment {
    variables = {
      MODEL_ID             = var.model_id
      SYSTEM_PROMPT        = var.system_prompt
      REGION               = var.region
      ENABLE_MEMORY        = var.enable_memory ? "1" : "0"
      TABLE_NAME           = var.enable_memory ? aws_dynamodb_table.memory[0].name : ""
      MEMORY_MAX           = tostring(var.memory_max_messages)
      ALLOWED_ORIGINS      = join(",", local.cors_origins)
      MAX_REQUESTS_PER_DAY = tostring(var.max_requests_per_day) # Daily cap enforcement
    }
  }

  tags = merge(var.tags, { "Name" = local.lambda_name, "Environment" = var.env })
}

# -------------------------------
# API Gateway v2 (HTTP API)
# -------------------------------
resource "aws_apigatewayv2_api" "api" {
  name          = local.api_name
  protocol_type = "HTTP"
  cors_configuration {
    allow_credentials = false
    allow_headers     = ["content-type", "authorization"]
    allow_methods     = ["OPTIONS", "POST"] # Only allow chat POST + CORS
    allow_origins     = local.cors_origins
    max_age           = 600
  }
  tags = merge(var.tags, { "Environment" = var.env })
}

# Integrate Lambda with API Gateway
resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY" # Proxy pass-through
  integration_uri        = aws_lambda_function.neo.arn
  payload_format_version = "2.0" # Modern HTTP API payload
}

# Define the route POST /neo-chat
resource "aws_apigatewayv2_route" "route" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /neo-chat"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Stage (auto-deploy for simplicity)
resource "aws_apigatewayv2_stage" "stage" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = local.stage_name
  auto_deploy = true
}

# Allow API Gateway to invoke the Lambda
resource "aws_lambda_permission" "apigw_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.neo.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
