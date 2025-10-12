# File: infrastructure/terraform/variables.tf
# Purpose: Variable definitions

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "database_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "database_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 100
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "ecs_backend_desired_count" {
  description = "Desired number of backend tasks"
  type        = number
  default     = 3
}

variable "ecs_backend_cpu" {
  description = "CPU units for backend task"
  type        = number
  default     = 512
}

variable "ecs_backend_memory" {
  description = "Memory (MB) for backend task"
  type        = number
  default     = 1024
}

variable "domain_name" {
  description = "Domain name for portals"
  type        = string
  default     = "healthflow.ai"
}

variable "enable_waf" {
  description = "Enable AWS WAF"
  type        = bool
  default     = true
}

variable "enable_backup" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}