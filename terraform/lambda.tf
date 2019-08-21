provider "archive" {}

data "archive_file" "data-collector-zip" {
  type        = "zip"
  output_path = "./handler.zip"
  source_dir  = "../src"
}

# Get Master
resource "aws_lambda_function" "data-collector-lambda-getMaster" {
  function_name    = "data-collector-getMaster"
  filename         = data.archive_file.data-collector-zip.output_path
  source_code_hash = data.archive_file.data-collector-zip.output_base64sha256
  handler          = "handler.getMaster"
  runtime          = "nodejs10.x"
  timeout          = 30
  description      = "Gets and stores a record of the register of register entries in Dynamo"
  role             = aws_iam_role.data-collector-iam-role.arn

  environment {
    variables = {
      type = "brownfield-sites"
    }
  }

  # Billing tags
  tags = local.digital_land_tags
}

resource "aws_lambda_permission" "data-collector-lambda-permission" {
  action        = "lambda:InvokeFunction"
  principal     = "events.amazonaws.com"
  function_name = aws_lambda_function.data-collector-lambda-getMaster.function_name
  source_arn    = aws_cloudwatch_event_rule.data-collector.arn
}

# Get singular
resource "aws_lambda_function" "data-collector-lambda-getSingular" {
  function_name    = "data-collector-getSingular"
  filename         = data.archive_file.data-collector-zip.output_path
  source_code_hash = data.archive_file.data-collector-zip.output_base64sha256
  handler          = "handler.getSingular"
  runtime          = "nodejs10.x"
  timeout          = 10
  description      = "Gets and stores a singular stream reference file from Dynamo into S3"
  role             = aws_iam_role.data-collector-iam-role.arn

  # Billing tags
  tags = local.digital_land_tags
}

resource "aws_lambda_event_source_mapping" "data-collector-event" {
  batch_size        = 1
  enabled           = true
  starting_position = "LATEST"
  function_name     = aws_lambda_function.data-collector-lambda-getSingular.arn
  event_source_arn  = aws_dynamodb_table.data-collector-dynamodb.stream_arn
}
