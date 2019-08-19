# TODO: Double check resources
data "aws_iam_policy_document" "data-collector-iam-policy" {
  statement {
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]

    resources = [
      "arn:aws:logs:*:*:*"
    ]
  }

  statement {
    effect = "Allow"

    actions = [
      "dynamodb:BatchWriteItem",
      "dynamodb:DescribeStream",
      "dynamodb:GetRecords",
      "dynamodb:GetShardIterator",
      "dynamodb:ListStreams",
      "dynamodb:Query",
      "dynamodb:UpdateItem"
    ]

    resources = [
      "${aws_dynamodb_table.data-collector-dynamodb.arn}/index/*",
      aws_dynamodb_table.data-collector-dynamodb.arn,
      aws_dynamodb_table.data-collector-dynamodb.stream_arn
    ]
  }

  statement {
    effect = "Allow"

    actions = [
      "s3:PutObject"
    ]

    resources = [
      "${aws_s3_bucket.data-collector.arn}/*"
    ]
  }
}

resource "aws_iam_role" "data-collector-iam-role" {
  name               = "data-collector-iam-role"
  assume_role_policy = file("json/assume_role_policy.json")

  # Billing tags
  tags = local.digital_land_tags
}

resource "aws_iam_policy" "data-collector-iam-policy" {
  name   = "data-collector-iam-policy"
  policy = data.aws_iam_policy_document.data-collector-iam-policy.json
  path   = "/"
}

resource "aws_iam_role_policy_attachment" "data-collector-iam-attachment" {
  role       = aws_iam_role.data-collector-iam-role.name
  policy_arn = aws_iam_policy.data-collector-iam-policy.arn
}
