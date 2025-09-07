#!/usr/bin/env python3
# neon1-site :: scripts/init_backend_from_bootstrap.py
#
# Purpose:
#   This script fills in backend.hcl files for each environment (dev, staging, prod)
#   with values from the Terraform bootstrap stack (infra/bootstrap).
#
# Context:
#   - The bootstrap stack creates an S3 bucket + DynamoDB table for storing Terraform state.
#   - After running `terraform apply` in infra/bootstrap, an outputs.json file is produced.
#   - This script reads that outputs.json and writes backend.hcl files that Terraform can consume.
#
# Related:
#   - infra/bootstrap/main.tf
#   - infra/envs/*/backend.hcl

import json
import os
import pathlib

# -------------------------------------------------------------------
# Define repo root path relative to this script
# -------------------------------------------------------------------
root = pathlib.Path(__file__).resolve().parents[1]

# Path to bootstrap outputs.json (must exist after terraform apply)
outputs_path = root / "infra" / "bootstrap" / "outputs.json"

# -------------------------------------------------------------------
# Read outputs.json from bootstrap
# -------------------------------------------------------------------
if not outputs_path.exists():
    raise SystemExit(
        "Error: outputs.json not found.\n"
        "Run `terraform -chdir=infra/bootstrap apply -auto-approve` first."
    )

outputs = json.loads(outputs_path.read_text())

# Extract S3 bucket + DynamoDB table names
bucket = outputs["state_bucket_name"]["value"]
table  = outputs["lock_table_name"]["value"]

# -------------------------------------------------------------------
# Build backend.hcl contents
# -------------------------------------------------------------------
# Each environment gets a backend.hcl that tells Terraform where
# to store its state and lock info (in the shared bucket/table).
# The key is env-specific, so each env has its own state file.
for env in ["dev", "staging", "prod"]:
    backend_config = (
        f'bucket         = "{bucket}"\n'
        f'key            = "{env}/terraform.tfstate"\n'
        f'dynamodb_table = "{table}"\n'
        f'region         = "{os.environ.get("AWS_REGION", "us-east-1")}"\n'
    )

    env_file = root / "infra" / "envs" / env / "backend.hcl"
    env_file.write_text(backend_config)

    print(f"Wrote backend.hcl for {env}: {env_file}")

print("Done. Each environment now points to the shared state backend.")
