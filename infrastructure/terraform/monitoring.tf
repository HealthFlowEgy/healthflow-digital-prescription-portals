# File: infrastructure/terraform/monitoring.tf
# Purpose: SNS topics and CloudWatch alarms

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "${local.name_prefix}-alerts"
  
  tags = local.common_tags
}

# SNS Topic Subscription - Email
resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = "devops@healthflow.ai"
}

# SNS Topic Subscription - Slack (via Lambda)
resource "aws_sns_topic_subscription" "alerts_slack" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.slack_notifier.arn
}

# SNS Topic for Notifications (SMS, Email)
resource "aws_sns_topic" "notifications" {
  name = "${local.name_prefix}-notifications"
  
  tags = local.common_tags
}

# Lambda Function for Slack Notifications
resource "aws_lambda_function" "slack_notifier" {
  filename      = "slack-notifier.zip"
  function_name = "${local.name_prefix}-slack-notifier"
  role          = aws_iam_role.lambda_slack_notifier.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  
  environment {
    variables = {
      SLACK_WEBHOOK_URL = var.slack_webhook_url
    }
  }
  
  tags = local.common_tags
}

resource "aws_iam_role" "lambda_slack_notifier" {
  name = "${local.name_prefix}-lambda-slack-notifier"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
  
  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_slack_notifier" {
  role       = aws_iam_role.lambda_slack_notifier.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_permission" "sns" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.slack_notifier.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.alerts.arn
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name_prefix}-dashboard"
  
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", { stat = "Average" }],
            [".", "MemoryUtilization", { stat = "Average" }]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "ECS Cluster Metrics"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", { stat = "Average" }],
            [".", "DatabaseConnections", { stat = "Average" }]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "RDS Metrics"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", { stat = "Average" }],
            [".", "RequestCount", { stat = "Sum" }]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "ALB Metrics"
        }
      }
    ]
  })
}

# Composite Alarm - System Health
resource "aws_cloudwatch_composite_alarm" "system_health" {
  alarm_name          = "${local.name_prefix}-system-health"
  alarm_description   = "Composite alarm for overall system health"
  actions_enabled     = true
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  
  alarm_rule = "ALARM(${aws_cloudwatch_metric_alarm.database_cpu.alarm_name}) OR ALARM(${aws_cloudwatch_metric_alarm.redis_cpu.alarm_name}) OR ALARM(${aws_cloudwatch_metric_alarm.backend_api_health.alarm_name})"
  
  tags = local.common_tags
}