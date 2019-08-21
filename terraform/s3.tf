resource "aws_s3_bucket" "data-collector" {
  bucket = "digital-land-data-collector"
  region = "eu-west-2"
  acl    = "private"

  # Billing tags
  tags = local.digital_land_tags
}
