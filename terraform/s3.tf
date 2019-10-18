resource "aws_s3_bucket" "data-collector" {
  bucket = "digital-land-data-collector-test"
  region = "eu-west-2"
  acl    = "public-read"

  # Billing tags
  tags = local.digital_land_tags
}
