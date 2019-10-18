data "archive_file" "data-collector-zip" {
  type = "zip"
  output_path = "./handler.zip"
  source_dir = "../src"
}

resource "aws_lambda_function" "data-collector-lambda-getMaster" {
  function_name    = "data-collector-getMaster"
  filename         = data.archive_file.data-collector-zip.output_path
  source_code_hash = data.archive_file.data-collector-zip.output_base64sha256
  handler          = "handler.getMaster"
  runtime          = "nodejs10.x"
  timeout          = 30
  role             = aws_iam_role.data-collector-iam-role.arn

  environment {
    variables = {
      dataset = "brownfield-sites"
      sqsurl  = aws_sqs_queue.data-collector-queue.id
    }
  }

  # Billing tags
  tags = local.digital_land_tags
}

resource "aws_lambda_function" "data-collector-lambda-getSingular" {
  function_name    = "data-collector-getSingular"
  filename         = data.archive_file.data-collector-zip.output_path
  source_code_hash = data.archive_file.data-collector-zip.output_base64sha256
  handler          = "handler.getSingular"
  runtime          = "nodejs10.x"
  timeout          = 30
  role             = aws_iam_role.data-collector-iam-role.arn

  environment {
    variables = {
      dataset = "brownfield-sites"
      sqsurl  = aws_sqs_queue.data-collector-queue.id
      bucket  = aws_s3_bucket.data-collector.id
    }
  }

  # Billing tags
  tags = local.digital_land_tags
}

resource "aws_lambda_event_source_mapping" "data-collector-getSingular-event-source" {
  event_source_arn = aws_sqs_queue.data-collector-queue.arn
  function_name    = aws_lambda_function.data-collector-lambda-getSingular.arn
  batch_size = 1
  enabled = true
}
