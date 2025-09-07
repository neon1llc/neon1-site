/*
  neon1-site :: infra/modules/neo-chat/outputs.tf
  Purpose: Output values for the Neo chat backend (Lambda + API + optional DynamoDB).
  These are consumed by env root modules and CI/CD.
*/

# Base URL for the API Gateway stage (e.g., https://abc123.execute-api.us-east-1.amazonaws.com/v1)
# Useful if you want to extend the API with more routes later
output "api_base_url" {
  value = "${aws_apigatewayv2_api.api.api_endpoint}/${aws_apigatewayv2_stage.stage.name}"
}

# Full URL for the Neo chat route (POST /neo-chat)
# This is what the frontend uses to send messages to Neo
output "api_url" {
  value = "${aws_apigatewayv2_api.api.api_endpoint}/${aws_apigatewayv2_stage.stage.name}/neo-chat"
}

# The deployed Lambda’s function name
# Handy for debugging/logging or if you want to run `aws lambda invoke`
output "lambda_function_name" {
  value = aws_lambda_function.neo.function_name
}

# DynamoDB table name used for chat memory (if enabled)
# Empty string if memory is disabled
output "table_name" {
  value = var.enable_memory ? aws_dynamodb_table.memory[0].name : ""
}
