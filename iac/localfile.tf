
resource "random_integer" "value" {
  min = 1
  max = 50000
}

resource "local_file" "local_output" {
  content = <<EOF
   cognito_pool_id=${aws_cognito_identity_pool.my_identity_pool.id}
   kvs_arn=${awscc_kinesisvideo_signaling_channel.my_channel.arn}
   role_arn=${aws_iam_role.kvs_sts_role.arn}
  EOF
  filename = "./output.txt"
}

resource "local_file" "local_command_output" {
  content = <<EOF
  
    ##產生臨時ID(未授權身份)
    aws cognito-identity get-id --identity-pool-id ${aws_cognito_identity_pool.my_identity_pool.id}

    ##取得token 
    aws cognito-identity get-open-id-token --identity-id <identity-id>

    ##取得臨時憑證
    aws sts assume-role-with-web-identity \
        --role-arn ${aws_iam_role.kvs_sts_role.arn} \
        --role-session-name ${random_integer.value.result} \
        --web-identity-token <token> \
        --duration-seconds 3600
  EOF
  filename = "./command.txt"
}