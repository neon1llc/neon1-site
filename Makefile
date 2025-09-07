# neon1-site :: Makefile
# Purpose: One-liners for common Terraform + build tasks (repo root aware of src/).

AWS_REGION ?= us-east-1
TF_DIR     = src/infra

.PHONY: help
help:
	@echo "Targets:"
	@echo "  bootstrap        - init/apply bootstrap backend"
	@echo "  plan-development - plan for development"
	@echo "  deploy-development - apply for development"
	@echo "  plan-staging     - plan for staging"
	@echo "  deploy-staging   - apply for staging"
	@echo "  plan-production  - plan for production"
	@echo "  deploy-production - apply for production"
	@echo "  build            - build site into dist/"
	@echo "  fmt              - terraform fmt"

bootstrap:
	terraform -chdir=$(TF_DIR)/bootstrap init
	terraform -chdir=$(TF_DIR)/bootstrap apply -auto-approve
	terraform -chdir=$(TF_DIR)/bootstrap output -json > $(TF_DIR)/bootstrap/outputs.json
	AWS_REGION=$(AWS_REGION) python3 src/scripts/init_backend_from_bootstrap.py

plan-development:
	terraform -chdir=$(TF_DIR)/envs/development init -backend-config=backend.hcl
	terraform -chdir=$(TF_DIR)/envs/development plan -var-file=development.tfvars

deploy-development:
	terraform -chdir=$(TF_DIR)/envs/development init -backend-config=backend.hcl
	terraform -chdir=$(TF_DIR)/envs/development apply -auto-approve -var-file=development.tfvars

plan-staging:
	terraform -chdir=$(TF_DIR)/envs/staging init -backend-config=backend.hcl
	terraform -chdir=$(TF_DIR)/envs/staging plan -var-file=staging.tfvars

deploy-staging:
	terraform -chdir=$(TF_DIR)/envs/staging init -backend-config=backend.hcl
	terraform -chdir=$(TF_DIR)/envs/staging apply -auto-approve -var-file=staging.tfvars

plan-production:
	terraform -chdir=$(TF_DIR)/envs/production init -backend-config=backend.hcl
	terraform -chdir=$(TF_DIR)/envs/production plan -var-file=production.tfvars

deploy-production:
	terraform -chdir=$(TF_DIR)/envs/production init -backend-config=backend.hcl
	terraform -chdir=$(TF_DIR)/envs/production apply -auto-approve -var-file=production.tfvars

build:
	bash src/scripts/build.sh

fmt:
	terraform -chdir=$(TF_DIR) fmt -recursive
