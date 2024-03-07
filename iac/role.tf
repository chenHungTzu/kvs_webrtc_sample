
resource "aws_iam_role" "kvs_sts_role" {
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
    {
            "Effect": "Allow",
            "Principal": {
                "Federated": "cognito-identity.amazonaws.com"
            },
            "Action": "sts:AssumeRoleWithWebIdentity",
            "Condition": {
                "StringEquals": {
                    "cognito-identity.amazonaws.com:aud": "${aws_cognito_identity_pool.my_identity_pool.id}"
                },
                "ForAnyValue:StringLike": {
                    "cognito-identity.amazonaws.com:amr": "unauthenticated"
                }
            }
        }
    ]
  })
}

resource "aws_iam_role_policy" "kvs_sts_role_policy" {
  role = aws_iam_role.kvs_sts_role.name

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
     {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
               	"kinesisvideo:Describe*",
				        "kinesisvideo:Get*",
				        "kinesisvideo:List*",
				        "kinesisvideo:Connect*"
            ],
            "Resource": "${awscc_kinesisvideo_signaling_channel.my_channel.arn}"
        }
    ],
  })
}
