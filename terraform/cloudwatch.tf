resource "aws_cloudwatch_event_rule" "data-collector" {
  name                = "data-collector-getDatasets"
  description         = "Run the data-collector.getDatasets handler every day at 00:00am UTC"
  schedule_expression = "cron(0 0 * * ? *)"
  is_enabled          = true

  # Billing tags
  tags = local.digital_land_tags
}

resource "aws_cloudwatch_event_target" "data-collector-target" {
  rule      = aws_cloudwatch_event_rule.data-collector.name
  target_id = "data-collector-event-target"
  arn       = aws_lambda_function.data-collector-lambda-getDatasets.arn
}
