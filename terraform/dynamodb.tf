resource "aws_dynamodb_table" "data-collector-dynamodb" {
  # General setup
  name           = "DataCollector"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "date"
  range_key      = "organisation"

  # Attributes
  attribute {
    name = "date"
    type = "S"
  }

  attribute {
    name = "organisation"
    type = "S"
  }

  # DynamoDB Stream
  stream_enabled   = true
  stream_view_type = "NEW_IMAGE"

  # Global Secondary Index - to enable cost-effective queries rather than scans
  global_secondary_index {
    name            = "OrganisationDateIndex"
    hash_key        = "organisation"
    range_key       = "date"
    write_capacity  = 1
    projection_type = "ALL"
  }

  # Billing tags
  tags = local.digital_land_tags
}
