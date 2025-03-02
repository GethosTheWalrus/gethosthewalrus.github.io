# Terraforming a Node.js application onto OCI and AWS <span style="opacity:0.5;margin:0;padding:0;font-size:14px;">- December 8, 2023</span>

 This article describes how to deploy a Node.js application and its required infrastructure to the cloud. The final outcome of this guide is:

* A series of [Terraform](https://www.terraform.io/) modules used to create the app and its infrastructure
* A traditional deployment option on [OCI](https://www.oracle.com/cloud/) utilizing [compute instances](https://docs.oracle.com/en-us/iaas/Content/Compute/Concepts/computeoverview.htm) and [Autonomous Database](https://www.oracle.com/autonomous-database/)
* A serverless deployment option on [AWS](https://aws.amazon.com/) utilizing [Lambda](https://aws.amazon.com/lambda/) and [DynamoDB](https://aws.amazon.com/dynamodb/)

The full source code and all linked files can be found on my GitHub [here](https://github.com/GethosTheWalrus/oci-terraform-crud-api). If you prefer to run things right away you can run the following series of commands, assuming you have:

* A working Terraform installation
* Proper certificates generated for your OCI user
* A working AWS CLI configuration
* Populated terraform.tfvars

```
terraform init
terraform apply -auto-approve -target=module.oci
terraform apply -auto-approve -target=module.docker
terraform apply -auto-approve -target=module.aws
```

*Note: Although everything in this guide is free-tier ([OCI](https://www.oracle.com/cloud/free/#free-cloud-trial), [AWS](https://aws.amazon.com/free/?all-free-tier.sort-by=item.additionalFields.SortRank&all-free-tier.sort-order=asc&awsf.Free%20Tier%20Types=*all&awsf.Free%20Tier%20Categories=*all)) friendly, please make sure you're monitoring your own cloud costs. It is possible to incur AWS charges based on usage, should you accidentally exceed the free tier quotas. Thankfully, OCI gives you the option to lock your account to "Always Free" status.

<hr> 

## Building the infrastructure

The beauty of [Infrastructure As Code](https://en.wikipedia.org/wiki/Infrastructure_as_code) (IAC) is that once it is written it can be used to spin up and tear down cloud services as needed. This takes the manual work of creating and maintaining your infrastructure out of the equation.

## How Terraform works

This guide utilizes [Terraform](https://www.terraform.io/) to build our infrastructure in our public cloud tenancies. Before we jump into deploying things, there is some brief setup to take care of.

We will be dividing our infrastructure code into modules, each of which handles a specific task:

* Standing up network, compute, and storage resources in OCI 
* Deploying a docker container to the compute resource in OCI
* Deploying serverless compute and storage resources in AWS

Let's look at the [OCI module](https://github.com/GethosTheWalrus/oci-terraform-crud-api/tree/main/infrastructure/oci) as an example. Upon inspecting [configuration.tf](https://github.com/GethosTheWalrus/oci-terraform-crud-api/blob/main/infrastructure/oci/configuration.tf) and [provider.tf](https://github.com/GethosTheWalrus/oci-terraform-crud-api/blob/main/infrastructure/oci/provider.tf) you will see the following:

```
# configuration.tf
terraform {
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = ">= 5.0.0"
    }
  }
}

# provider.tf
provider "oci" {
  tenancy_ocid     = "${var.tenancy_ocid}"
  user_ocid        = "${var.user_ocid}"
  fingerprint      = "${var.fingerprint}"
  private_key_path = "${var.private_key_path}"
  region           = "${var.region}"
}
```

The above code defines the Terraform [provider](https://registry.terraform.io/providers/oracle/oci/latest/docs) that this module relies on, and configures it with the necessary parameters. This essentially defines how Terraform connects to and authenticates with the specified platform.

Also in this same directory is a [vars.tf](https://github.com/GethosTheWalrus/oci-terraform-crud-api/blob/main/infrastructure/oci/vars.tf) file, which contains the declarations for all of the variables that the OCI module utilizes. Values of these variables are either passed into the module or defined somewhere within it.

The last piece of config within the module is [outputs.tf](https://github.com/GethosTheWalrus/oci-terraform-crud-api/blob/main/infrastructure/oci/outputs.tf). This allows us to output values to the console following a Terraform apply command and also to reference these same values within other modules.

Finally, the rest of the files define resources within OCI that we will be creating:

```
locals {
  cmpt_name_prefix = "TF-LAB"
  time_f = formatdate("HHmmss", timestamp())
}

resource "oci_identity_compartment" "the_compartment" {
    compartment_id = var.compartment_id
    description = var.compartment_description
    name = "${local.cmpt_name_prefix}_${var.compartment_name}"
}
```

The above code is used to create a [compartment](https://docs.oracle.com/en/cloud/foundation/cloud_architecture/governance/compartments.html) resource within OCI.

You may have noticed that there are a lot of variable references within the Terraform files. Some of these variables' values are sensitive, and should not be shared with anyone. Such variables have been separated into a file called terraform.tfvars and placed in the infrastructure folder. You will need to populate those values. For your convenience, I have included a template in the repository which you can use to get started.

<hr>

## Deploying to OCI

Our deployment strategy for OCI will be to create a compute instance, install [Docker](https://www.docker.com/), clone our app from [GitHub](https://github.com/GethosTheWalrus/oci-terraform-crud-api), and run our app within a container. We will also be creating an Autonomous Database to be consumed via our app server.

To start the deploy, navigate to the infrastructure directory and run:

```
terraform apply -auto-approve -target=module.oci
```

After a while of processing you will see outputs similar to the following. Note that this step can take quite a while.

```
Apply complete! Resources: 8 added, 0 changed, 0 destroyed.

Outputs:

connection_string = "YOUR_CONNECTION_STRING"
db_state = "AVAILABLE"
lambda_url = "YOUR_LAMDBA_URL"
public_ip = [
  "YOUR_PUBLIC_IP",
] 
```

You should also be able to log into the OCI console and view your created resources:

<div class="blog-content-block">
    <img src="/img/blog/1701912307304.png" />
</div>

You should be able to SSH into your VM using the public ip from the Terraform output. If you list the contents of the ubuntu user's home directory, you will see that our API code repository has been cloned.

In your local console, run the following command in the infrastructure directory to provision the Docker infrastructure on our newly created compute instance:

```
terraform apply -auto-approve -target=module.docker
```

Once this completes, you will see similar output to the above. Running the following command on your compute instance will reveal that your docker container is now running on the instance:

```
docker ps
```

<div class="blog-content-block">
    <img src="/img/blog/1701912980433.png" />
</div>

At this point if all went well your app should be consumable over the internet, using the IP address from your Terraform output. We can test this with a quick curl:

```
curl http://YOUR_PUBLIC_IP/users

[{"id":1,"username":"user1"},{"id":2,"username":"user2"},{"id":3,"username":"user3"},{"id":4,"username":"user4"},{"id":5,"username":"user5"},{"id":6,"username":"user6"},{"id":7,"username":"user7"}]
```

<hr>

## Deploying to AWS

On AWS our deployment strategy will be a little bit different. We will be deploying our code as a Lambda function that consumes DynamoDB. This deployment is completely serverless.

To deploy to AWS, run the following command:

```
terraform apply -auto-approve -target=module.aws
```

After a few minutes, you will see the same output as when you deployed the OCI module. Since we do not need to deploy any Docker infrastructure, our app should be consumable over the internet using YOUR_LAMBDA_URL from the output:

curl YOUR_LAMBDA_URL/users

```
[{"id":7,"username":"user7"},{"id":3,"username":"user3"},{"id":2,"username":"user2"},{"id":4,"username":"user4"},{"id":6,"username":"user6"},{"id":1,"username":"user1"},{"id":5,"username":"user5"}]
```

<hr>

## Tearing everything down

When you are ready, run the following commands to destroy everything that we have deployed thus far:

```
terraform destroy -auto-approve
```

Once this finishes, you will notice that the two curl commands above no longer work, as the deployments no longer exist.

*Note: make sure you do not skip this step, as the above deployments are public and can be consumed by anyone who finds their URLs.

<hr>

## Summary

Utilizing IAC with platforms like Terraform is a great way to ensure that your infrastructure is portable, repeatable, and maintainable. As demonstrated by this example, it is also possible to employ it as a tool to deploy the same application to different types of infrastructure.

Hopefully this guide has demonstrated the value that IAC can provide, and how easy it can be to learn this topic given the different free tiers of public clouds.

Interested in learning more about developing applications using the Oracle database? Check out the following 2 articles where I show you how to build full stack JavaScript/TypeScript apps using Oracle Free23c!

* [Creating a Flappy Bird app with Oracle's JSON-relational duality views](/blog/?post=json-relational-duality-oracle-flappy-bird)
* [Building a chat feature with Oracle Advanced Queuing ](/blog/?post=oracle-advanced-queue-flappy-bird)