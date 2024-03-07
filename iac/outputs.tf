output "cognito_pool_id" {
  value = aws_cognito_identity_pool.my_identity_pool.id
}

output "kvs_arn" {
  value = awscc_kinesisvideo_signaling_channel.my_channel.arn
}

output "role_arn" {
  value = aws_iam_role.kvs_sts_role.arn
}