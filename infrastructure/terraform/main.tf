# File: infrastructure/terraform/main.tf
# Purpose: Main Terraform configuration for AWS infrastructure

terraform {
  required_version = ">= 1.6.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket         = "healthflow-terraform-state"
    key            = "portals/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-lock"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "HealthFlow Digital Prescription Portals"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Team        = "DevOps"
    }
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# Local variables
locals {
  name_prefix = "healthflow-portals-${var.environment}"
  
  common_tags = {
    Project     = "HealthFlow Portals"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
  
  azs = slice(data.aws_availability_zones.available.names, 0, 3)
}