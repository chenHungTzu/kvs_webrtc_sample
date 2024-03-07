resource "aws_cognito_identity_pool" "my_identity_pool" {
  identity_pool_name               = "my-identity-pool"
  allow_unauthenticated_identities = true 
  allow_classic_flow               = true
}