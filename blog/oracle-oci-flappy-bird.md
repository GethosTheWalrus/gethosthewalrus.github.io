# Deploying Flappy Bird to OCI with 3 short commands <span style="opacity:0.5;margin:0;padding:0;font-size:14px;">- June 18, 2024</span>

This article expands upon my ongoing series ([part 1](/blog/?post=json-relational-duality-oracle-flappy-bird), [part 2](/blog/?post=oracle-advanced-queue-flappy-bird)) where I show you how to build a Flappy Bird clone in Node.js utilizing [Oracle Database 23ai](https://blogs.oracle.com/database/post/oracle-23ai-now-generally-available) (formerly 23c). By the end of this guide, you will have done the following:

* Deployed a local containerized Flappy Bird application stack on your machine
* Created cloud infrastructure to support the same Flappy Bird application
* Deployed Flappy Bird to your cloud infrastructure in [OCI](https://www.oracle.com/cloud/)

The full source code and all linked files can be found on my GitHub [here](https://github.com/GethosTheWalrus/game-backend-oracle-db/tree/oci-deploy). If you prefer to run things right away, you can start all three services by executing the command below within the [infrastructure](https://github.com/GethosTheWalrus/game-backend-oracle-db/tree/main/infrastructure) folder of the repository given you have the following:

* A working [Terraform](https://www.terraform.io/) installation
* Proper certificates generated for your OCI user
* Populated terraform.tfvars

```
terraform init
terraform apply -auto-approve -target=module.oci
terraform apply -auto-approve -target=module.docker
```

*Note, this will take a while depending on the speed of your machine and your internet connection.

<hr>

## Recap and what's new

In [part 1](/blog/?post=json-relational-duality-oracle-flappy-bird) of the this series, we explored how to integrate a Flappy Bird game built using [Phaser.js](https://phaser.io/) with an Express.js backend on top of an Oracle database, and in [part 2](/blog/?post=oracle-advanced-queue-flappy-bird) we expanded the functionality of that game by adding a chat feature backed by [Oracle Advanced Queuing](https://www.oracle.com/database/advanced-queuing/).

Much of that code is exactly the same in part 3. In fact, you can run the game on your machine the same way by executing the following command within the root of the repository:

```
docker-compose up
```

In one of my [unrelated articles](/blog/?post=terraform-nodejs-oci-aws), I detailed how to deploy an Express.js application to OCI and [AWS](https://aws.amazon.com/) utilizing Terraform. The remainder of this article will focus on adapting that same methodology to one of the world's only games built on an Oracle Database.
Setting up your environment

We will be using Terraform to create our cloud infrastructure in OCI. As such, the first step is to make sure it is installed on your local machine. Follow the relevant [instructions](https://developer.hashicorp.com/terraform/install?ajs_aid=b97da580-bf3d-4087-9e13-8ac47250df3d&product_intent=terraform) for your operating system and verify a successful installation by running

```
terraform -v
```

in your terminal. You should see output similar to the below if Terraform is installed correctly.

<div class="blog-content-block">
    <img src="/img/blog/1718321175543.png" />
    <span class="footnote">Note the version (v1.8.5) and architecture (darwin_arm64)</span>
</div>

After Terraform is set up, you will need to connect it to your OCI account. You can follow these [instructions](https://docs.oracle.com/en-us/iaas/developer-tutorials/tutorials/tf-provider/01-summary.htm) to achieve this.

Once you have finished setting up terraform, clone the repository from the oci-deploy branch, which is a point-in-time snapshot of the code as of this writing.

Within the infrastructure folder, you should see a file called **terraform.tfvars**.template that looks like this:

```
# Authentication
tenancy_ocid         = "OCID of your tenandcy"
user_ocid            = "OCID of the your user"
private_key_path     = "path to your OCI private key"

# Region
region = "your preferred region"

# Compartment
compartment_id = "OCID of your parent compartment for this demo"

# Instance
my_ssh_public_keys = [
    "your public SSH keys (string, not path to file)"
]

my_private_key_path = "path to your machine's private key"

availability_domain = "your preferred availability domain (with prefix)"

# Database
my_public_ip =  "your current public IP"
```

Fill in the variables defined in that file and rename it to terraform.tfvars. That's it; it's really that simple. Your environment is now set up.
Taking a Quick Look at the Infrastructure

For simplicity, our Infrastructure As Code (IAC) consists of two modules: the OCI module and the [Docker](https://www.docker.com/) module. It is worth noting that in a more production-like environment, you would likely want to more granularly split your infrastructure modules.

The OCI module is responsible for creating the following infrastructure components:

* [Compartment](https://docs.oracle.com/en/cloud/foundation/cloud_architecture/governance/compartments.html)
* [VCN](https://www.oracle.com/cloud/networking/virtual-cloud-network/)
* [Subnet](https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/create_subnet.htm)
* [Internet Gateway](https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/managingIGs.htm)
* [Route Table](https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/managingroutetables.htm)
* [Security List](https://www.google.com/url?sa=t&source=web&rct=j&opi=89978449&url=https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securitylists.htm&ved=2ahUKEwjgy5LV4NmGAxWJtokEHTxcDcEQFnoECAYQAQ&usg=AOvVaw0_Dqpsv0wtPGTzw85gzgh3)
* [Instance](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm)
* [Autonomous Database](https://www.oracle.com/autonomous-database/)

Take a moment to review the above components in detail if you would like. In summary, we are creating a compartmentalized network which contains a single VM to host our app, and an autonomous database instance in which we will store our app's data.

Take some time to browse through the Terraform files within the OCI folder. You can easily see that each file contains resource definitions for their corresponding infrastructure components.

For example, within database.tf you can see the configuration for our autonomous database instance, based on these [docs](https://registry.terraform.io/providers/oracle/oci/latest/docs/data-sources/database_autonomous_database) from Hashicorp.

```
resource "oci_database_autonomous_database" "demo_database" {
    compartment_id = oci_identity_compartment.the_compartment.id
    db_name = var.demo_database.name
    display_name = var.demo_database.name
    db_workload = var.demo_database.db_workload
    admin_password = var.demo_database.admin_password
    db_version = var.demo_database.db_version
    is_free_tier = var.demo_database.is_free_tier
    whitelisted_ips = concat([var.my_public_ip], [for k in oci_core_instance.the_instance.*.public_ip : chomp(k)])
}
```

Upon closer inspection, you'll notice that the values are all referring to some other object, whether that is a predefined variable or an output from another component. Variables are defined in vars.tf and are populated either by terraform.tfvars or by the output of a previously created component.

If you are curious, now is a good time to click through the OCI infrastructure files and see how they are all connected to each other. 

<hr> 

## Running your game

Now that everything is set up and you understand how it all works, it is time to deploy your stack to the cloud.

Navigate to the infrastructure folder in your terminal. Run the following command:

```
terraform init
```

Terraform will read your infrastructure code and prepare a state file which will synchronize the state of your cloud infrastructure with your local Terraform installation.

Once that completes, bring up the cloud infrastructure and prepare the compute instance and database by running the following command:

```
terraform apply -auto-approve -target=module.oci
```

This step will take some time, but be sure not to move on to the next step before it completes. Once this step does complete, you will notice within the OCI console that you have a new instance and database, amongst other components. 

Compare the Public IP you see in the console to the one that Terraform outputs. They should be the same, indicating that your Terraform state file is in sync.

Finally, bring up the Flappy Bird application by running the following command:

```
terraform apply -auto-approve -target=module.docker
```

Terraform will do its thing again, and provide you with the same console output as was provided in the last step. However, this time you can take the public IP from the console output, put it in your browser, and enjoy your publicly hosted Flappy Bird game in OCI! 

<div class="blog-content-block">
    <img src="/img/blog/1718372703302.png" />
    <span class="footnote">Again, not my best score. Parenthood has hit my gaming skills the hardest.</span>
</div>

*Note, as configured the game will only be accessible to the IP assigned to the my_public_ip variable in terraform.tfvars.

Make sure you destroy your infrastructure when you are done. You can easily do so by running:

```
terraform destroy -auto-approve -target=module.docker && terraform destroy -auto-approve -target=module.oci
```

<hr>

## Conclusion

In this guide, we have successfully deployed an existing containerized application to OCI without creating a single service manually. 

Hopefully by this point you are convinced that managing your infrastructure with IAC such as Terraform is the way to go. It allows us to create, manage, and destroy cloud infrastructure without having to click through the console. 