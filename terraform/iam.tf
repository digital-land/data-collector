data "aws_iam_policy_document" "data-collector-iam-policy" {
  # for CloudFlare logging
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

  # for SQS access
  statement {
    actions = [
      "sqs:*"
    ]

    resources = [
      "arn:aws:sqs:*:*:*"
    ]
  }

  # for S3 access
  statement {
    actions = [
      "s3:*"
    ]

    resources = [
      "arn:aws:s3:::*"
    ]
  }
}

resource "aws_iam_role" "data-collector-iam-role" {
  name = "data-collector-iam-role"
  assume_role_policy = file("json/assume-lambda-policy.json")

  tags = local.digital_land_tags
}

resource "aws_iam_policy" "data-collector-iam-policy" {
  name = "data-collector-iam-policy"
  policy = data.aws_iam_policy_document.data-collector-iam-policy.json
}

resource "aws_iam_role_policy_attachment" "data-collector-iam-attachment" {
  role       = aws_iam_role.data-collector-iam-role.name
  policy_arn = aws_iam_policy.data-collector-iam-policy.arn
}
