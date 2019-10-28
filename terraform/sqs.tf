# This is the queue for dataset kickoff
resource "aws_sqs_queue" "data-collector-datasets-queue" {
  name                      = "data-collector-datasets-queue"
  message_retention_seconds = 21600
  tags                      = local.digital_land_tags
}

# This is the queue for the singular register
resource "aws_sqs_queue" "data-collector-queue" {
  name                      = "data-collector-queue"
  message_retention_seconds = 21600
  tags                      = local.digital_land_tags
}
