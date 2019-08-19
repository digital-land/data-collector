resource "aws_cloudwatch_event_rule" "data-collector" {
  name                = "data-collector-getMaster"
  description         = "Runs the data collector at 12am UTC every day"
  schedule_expression = "cron(0 0 * * ? *)"
  is_enabled          = true

  # Billing tags
  tags = local.digital_land_tags
}

resource "aws_cloudwatch_event_target" "data-collector-target" {
  rule      = aws_cloudwatch_event_rule.data-collector.name
  target_id = "data-collector"
  arn       = aws_lambda_function.data-collector-lambda-getMaster.arn
}
