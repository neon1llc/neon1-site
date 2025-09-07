
# neon1-site :: Makefile
# Purpose: One-liners to speed up common Terraform + build tasks.

AWS_REGION ?= us-east-1

.PHONY: help
help:
	@echo "Targets:"
	@echo "  bootstrap        - terraform init/apply for infra/bootstrap"
	@echo "  plan-dev         - terraform plan for dev"
	@echo "  deploy-dev       - terraform apply for dev"
	@echo "  plan-staging     - terraform plan for staging"
	@echo "  deploy-staging   - terraform apply for staging"
	@echo "  plan-prod        - terraform plan for prod"
	@echo "  deploy-prod      - terraform apply for prod"
	@echo "  build            - build/copy site into dist/"
	@echo "  fmt              - terraform fmt across infra/"

bootstrap:
	terraform -chdir=infra/bootstrap init
	terraform -chdir=infra/bootstrap apply -auto-approve
	terraform -chdir=infra/bootstrap output -json > infra/bootstrap/outputs.json
	AWS_REGION=$(AWS_REGION) python3 scripts/init_backend_from_bootstrap.py

plan-dev:
	terraform -chdir=infra/envs/dev init -backend-config=backend.hcl
	terraform -chdir=infra/envs/dev plan -var-file=development.tfvars

deploy-dev:
	terraform -chdir=infra/envs/dev init -backend-config=backend.hcl
	terraform -chdir=infra/envs/dev apply -auto-approve -var-file=development.tfvars

plan-staging:
	terraform -chdir=infra/envs/staging init -backend-config=backend.hcl
	terraform -chdir=infra/envs/staging plan -var-file=staging.tfvars

deploy-staging:
	terraform -chdir=infra/envs/staging init -backend-config=backend.hcl
	terraform -chdir=infra/envs/staging apply -auto-approve -var-file=staging.tfvars

plan-prod:
	terraform -chdir=infra/envs/prod init -backend-config=backend.hcl
	terraform -chdir=infra/envs/prod plan -var-file=production.tfvars

deploy-prod:
	terraform -chdir=infra/envs/prod init -backend-config=backend.hcl
	terraform -chdir=infra/envs/prod apply -auto-approve -var-file=production.tfvars

build:
	bash scripts/build.sh

fmt:
	terraform -chdir=infra fmt -recursive
