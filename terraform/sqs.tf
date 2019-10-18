resource "aws_sqs_queue" "data-collector-queue" {
  name = "data-collector-queue" # this is the collection queue only
  tags = local.digital_land_tags
}
