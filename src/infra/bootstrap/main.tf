
/*
  neon1-site :: infra/bootstrap/main.tf
  Purpose: Create S3 bucket (TF state) + DynamoDB lock table.
  Use: terraform -chdir=infra/bootstrap apply
*/
resource "random_id" "suffix" { byte_length = 4 }

resource "aws_s3_bucket" "state" {
  bucket        = "${var.project}-tfstate-${random_id.suffix.hex}"
  force_destroy = false
  tags          = { Project = var.project }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "lock" {
  name         = "${var.project}-tflock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  attribute {
    name = "LockID"
    type = "S"
  }
}
