# File: infrastructure/terraform/route53.tf
# Purpose: Route53 DNS configuration

# Data source for existing hosted zone
data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}

# Route53 Record - Backend API
resource "aws_route53_record" "backend_api" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "portals-api.${var.domain_name}"
  type    = "A"
  
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# Route53 Record - Regulatory Portal
resource "aws_route53_record" "portals" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "portals.${var.domain_name}"
  type    = "A"
  
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# Route53 Record - Staging Backend API
resource "aws_route53_record" "staging_backend_api" {
  count   = var.environment == "staging" ? 1 : 0
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "staging-portals-api.${var.domain_name}"
  type    = "A"
  
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# Route53 Record - Staging Portals
resource "aws_route53_record" "staging_portals" {
  count   = var.environment == "staging" ? 1 : 0
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "staging-portals.${var.domain_name}"
  type    = "A"
  
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# ACM Certificate Validation Records
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }
  
  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main.zone_id
}

# ACM Certificate Validation
resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# Health Check for Backend API
resource "aws_route53_health_check" "backend_api" {
  fqdn              = "portals-api.${var.domain_name}"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"
  measure_latency   = true
  
  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-backend-api-health-check"
    }
  )
}

# CloudWatch Alarm for Health Check
resource "aws_cloudwatch_metric_alarm" "backend_api_health" {
  alarm_name          = "${local.name_prefix}-backend-api-health-check"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = "60"
  statistic           = "Minimum"
  threshold           = "1"
  alarm_description   = "This metric monitors backend API health check"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  
  dimensions = {
    HealthCheckId = aws_route53_health_check.backend_api.id
  }
  
  tags = local.common_tags
}