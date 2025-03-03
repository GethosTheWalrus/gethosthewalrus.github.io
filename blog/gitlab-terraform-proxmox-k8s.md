# Deploying A Kubernetes Cluster To PVE Using GitLab CI <span style="opacity:0.5;margin:0;padding:0;font-size:14px;">- March 4, 2025</span>

This guide will show you how to deploy a Kubernetes cluster onto two or more virtual machines hosted within a [PVE](https://pve.proxmox.com/wiki/Main_Page) homelab environment. We will leverage Terraform and GitLab CI to automate this process, ensuring that any changes to the infrastructure can be painlessly tracked and propagated. By the end of this article, you will have learned how to: 

* Provision infrastructure to an existing [PVE](https://pve.proxmox.com/wiki/Main_Page) environment
* Initialize the cluster by installing and configuring [Kubernetes](https://kubernetes.io/)
* Deploy essential and custom services like [MetalLB](https://metallb.io/) and [NGINX](https://nginx.org/)

You can clone my GitHub [repo](https://github.com/GethosTheWalrus/proxmox-k8s-infra) and skip most of code-based setup, if you prefer.

<hr>

## Prerequisites

* At least one running PVE node accessible via API
* A [GitLab](https://about.gitlab.com/) instance with CI/CD enabled and configured to use the [Docker executor](https://docs.gitlab.com/runner/executors/docker/)
* [Terraform](https://www.terraform.io/) and [Git](https://git-scm.com/) installed locally

<hr>

## Provisioning the infrastructure

Before we get into setting up our pipeline, it is important to validate that we can create our infrastructure using Terraform. To do this, we will utilize the [bpg/proxmox](https://registry.terraform.io/providers/bpg/proxmox/latest) Terraform provider. This provider allows us to create resources on our PVE node(s) by translating our Terraform code into Proxmox API commands, understandable by our lab.

Create a file called `main.tf` and populate it with the following code:

```
terraform {
  required_providers {
    proxmox = {
      source = "bpg/proxmox"
      version = "0.71.0"
    }
  }
}

provider "proxmox" {
  endpoint = "https://proxmox1.home:8006/"
  username = var.username
  password = var.password
  insecure = true

  ssh {
    agent = true
    username = "root"
  }
}

variable "username" { type=string }
variable "password" { type=string }
```

This code sets up or provider, and configures it to communicate with our self-hosted PVE node, `https://proxmox1.home:8006` in my case. Change the endpoint URL so that it points to where your PVE node is hosted.

Next, we'll need to define some resources to deploy to our environment, which we configured above. Create a file called `vms.tf` and add the following code:

```
# the Ubuntu cloud image from which our VMs will be created
resource "proxmox_virtual_environment_download_file" "ubuntu_cloud_image" {
  content_type   = "iso"
  datastore_id   = var.os_image_datastore_id
  node_name      = var.pve_node
  url            = var.os_image
}

# an RSA key that we will use for communication between the VMs
resource "tls_private_key" "vm_key" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

output "vm_private_key" {
  value     = tls_private_key.vm_key.private_key_pem
  sensitive = true
}

output "vm_public_key" {
  value = tls_private_key.vm_key.public_key_openssh
}

# A VM which will act as one of our nodes
resource "proxmox_virtual_environment_vm" "k8s3" {
  depends_on      = [proxmox_virtual_environment_vm.k8s1]
  name            = "k8s3"
  node_name       = var.pve_node
  stop_on_destroy = true
  initialization {
    user_account {
      keys        = [trimspace(tls_private_key.vm_key.public_key_openssh)]
      username    = var.os_user
      password    = var.os_password
    }
    ip_config {
      ipv4 {
        address = "192.168.69.82/24"
        gateway = "192.168.69.1"
      }
    }
  }

  network_device {
    model = "vmxnet3"
  }

  cpu {
    cores = var.cpu_cores
    type  = var.cpu_type
  }

  memory {
    dedicated = var.dedicated_memory
  }

  disk {
    datastore_id = var.datastore_id
    file_id      = proxmox_virtual_environment_download_file.ubuntu_cloud_image.id
    interface    = "virtio0"
    iothread     = true
    discard      = "on"
    size         = var.disk_size
  }
}

# Variables required for the above resources
variable "cpu_cores" {
    type=number
    default=2
}
variable "cpu_type" {
    type=string
    default="x86-64-v2-AES"
}
variable "dedicated_memory" {
    type=number
    default=2048
}
variable "disk_size" {
    type=number
    default=20
}
variable "datastore_id" {
    type=string
    default="big-nas"
}
variable "os_image" {
    type=string
    default="https://cloud-images.ubuntu.com/oracular/current/oracular-server-cloudimg-amd64.img"
}
variable "pve_node" {
    type=string
    default="proxmox1"
}
variable "os_user" {
    type=string
    default="k8s"
}
variable "os_password" {
    type=string
    default="s8k"
}
variable "os_image_datastore_id" {
    type=string
    default="local"
}
```

Let's unpack the resources defined above. First, we define a resource for the ISO file we will use to create our VMs. Canonical conveniently provides us with [Ubuntu Server cloud images](https://cloud-images.ubuntu.com/), commonly used as a baseline in AWS, Azure, OCI, etc. 

We will create our ISO resource using the most recent version of [Ubuntu server](https://cloud-images.ubuntu.com/oracular/) at the time of writing. 

Next, we need to create a resource for the RSA key that will allow the VMs to communicate with each other. This key will be generated on the fly as our infrastructure is provisioned.

Finally, we need to define resources for the actual VMs that will make up our cluster. The example above shows a single VM resource. You should replicate and modify the example resource above to suit your environment, taking care to ensure that your VMs are on the appropriate network segment.

When you are ready, you can run the following command to begin provisioning your infrastructure. If your variable values are not preconfigured, you will be asked to provide them at runtime in your terminal.

```
terraform init
terraform apply -auto-approve
```

If all went well, you should see your targeted PVE node working its magic and creating the resources that you defined.

<div class="blog-content-block">
    <img src="/img/blog/pve-k8s-vms.png" />
</div>

<hr>

## Migrating your Terraform state

Now that we have successfully designed and deployed our Terraform infrastructure, we can focus on automating things. If you have not already done so, create a respository for your project within your GitLab instance, and push up your Terraform code.

Create a `.gitlab-ci.yml` file in the root of your repo as well.

You will also need to make sure that your instance and repository are configured with the ability to [manage your project's Terraform state](https://docs.gitlab.com/user/infrastructure/iac/terraform_state/). We will cover the steps required to migrate your state from your local machine to your GitLab instance in the next section.

<div class="blog-content-block">
    <img src="/img/blog/terraform-proxmox-repo.png" />
</div>

Now that or repository is configured, we need to migrate our Terraform state to our GitLab instance. GitLab provides great [instructions](https://docs.gitlab.com/user/infrastructure/iac/terraform_state/) for getting this set up.

Modify the `terraform` resource in your `main.tf` file, adding a `backend` configuration item, which you should set to `http {}`.

```
terraform {
  required_providers {
    proxmox = {
      source = "bpg/proxmox"
      version = "0.71.0"
    }
  }
  backend "http" {}
}
```

For quick reference, you can modify and run the command below, where `TF_ADDRESS` is the URL of your GitLab project, and `TF_USERNAME` / `TF_PASSWORD` are the credentials for authenticating to it. You will likely need to generate a [personal access token](https://docs.gitlab.com/user/profile/personal_access_tokens/) for your GitLab user to use as the password.

```
terraform init \
  -migrate-state \
  -backend-config=address=${TF_ADDRESS} \
  -backend-config=lock_address=${TF_ADDRESS}/lock \
  -backend-config=unlock_address=${TF_ADDRESS}/lock \
  -backend-config=username=${TF_USERNAME} \
  -backend-config=password=${TF_PASSWORD} \
  -backend-config=lock_method=POST \
  -backend-config=unlock_method=DELETE \
  -backend-config=retry_wait_min=5
```

Once the above command has completed successfully, your Terraform state will now be saved within your GitLab project. This is useful for running your pipeline, as it allows changes you make using your local Terraform installation to always be in sync with the ones your pipeline makes.

If you wanted to run Terraform commands manually on your workstation without interacting with the pipeline, you could safely do that with this setup. Having your state managed by GitLab also allows pipeline worker processes to stay synchronized, so that you can define many small jobs instead of having your entire pipeline run in one giant worker process.

<hr>

## Setting up the pipeline

We are almost home. Lets configure the final part of our [pipeline](https://docs.gitlab.com/ci/pipelines/) - the pipeline itself. In a previous step, you should have created a file called `gitlab-ci.yml` in the root of your repository. If you did not, do so now.

Populate that file with the following contents:

```
stages:
  - build
  - deploy
  - destroy

deploy-cluster:
  stage: build
  image: 
    name: hashicorp/terraform:latest
    entrypoint: [""]
  before_script:
    - export TF_VAR_username=$(echo "$PVEUSER" | base64 -d)
    - export TF_VAR_password=$(echo "$PVEPASSWORD" | base64 -d)
    - export PROJECT_ID=5
    - export TF_USERNAME=$(echo "$GITLABUSERNAME" | base64 -d)
    - export TF_PASSWORD=$(echo "$GITLABACCESSTOKEN" | base64 -d)
    - export TF_ADDRESS="http://git.home/api/v4/projects/$PROJECT_ID/terraform/state/proxmox-k8s-infra"
    - terraform init -backend-config=address=${TF_ADDRESS} -backend-config=lock_address=${TF_ADDRESS}/lock -backend-config=unlock_address=${TF_ADDRESS}/lock -backend-config=username=${TF_USERNAME} -backend-config=password=${TF_PASSWORD} -backend-config=lock_method=POST -backend-config=unlock_method=DELETE -backend-config=retry_wait_min=5
  script:
    - terraform apply --auto-approve=true
    - terraform output vm_private_key > key
    - terraform output vm_public_key > key.pub
    - sed -i '1d;$d' key
    - chmod 600 key
    - cat key
  rules:
  - if: '$CI_COMMIT_BRANCH == "main"'
  artifacts:
    paths:
      - scripts
      - key
```

There is quite a bit to unpack in the above snippet. For the sake of brevity, we are defining a pipeline with 3 stages: `build`, `deploy`, `destroy`. We are creating a single job called `deploy-cluster` which is a member of the `build` stage. This job uses the official [hashicorp/terraform](https://hub.docker.com/r/hashicorp/terraform) image to deploy the terraform resources that we defined earlier. Note the commands in the `script` section of the YAML and you will see.

Before commiting this file, make sure you change the `TF_ADDRESS` variable in the `before_script` section to suit your environment. If you are keen-eyed, you will notice that several variables are referenced  in this config that do not appear to be defined. You are not crazy. These variable are managed by GitLab, and we will need to define them.

Follow GitLab's [instructions](https://docs.gitlab.com/ci/variables/) and configure the following variables for your project:

* `PVEUSER` - a BASE64 encoded string representing the PVE username you used in your Terraform config
* `PVEPASSWORD` - a BASE64 encoded string representing the PVE password you used in your Terraform config
* `GITLABUSERNAME` - a BASE64 encoded string representing your GitLab username
* `GITLABACCESSTOKEN` - a BASE64 encoded string representing your GitLab PAT

The CI job is configured to trigger when a commit is merged into `main`. Push everything to `main` and if all is configured correctly, you will see a new pipeline spawn and begin running. 

<div class="blog-content-block">
    <img src="/img/blog/gitlab-ci-new-pipeline.png" />
</div>

Clicking on the pipeline ID in the list will reveal which [jobs](https://docs.gitlab.com/ci/jobs/) are running and their statuses. You will only see one job since that is all we have defined so far.

<div class="blog-content-block">
    <img src="/img/blog/gitlab-ci-pipeline-jobs.png" />
</div>

After a while, you should see the `deploy-cluster` job either (hopefully) succeed or fail. If it succeeds, check your PVE node and ensure the VMs were created.

<hr>

## Automating Kubernetes

If you are still here I both thank and commend you. It has been a long ride, but we are finally ready to start deploying and configuring Kubernetes!

To do this, we will need to create some additional CI jobs. Open your `gitlab-ci.yml` file and append the following content:

```
init-master:
  stage: build
  image:
    name: ubuntu:latest
  variables:
    K8S1: 192.168.69.80
    ROLE: master
    TOKEN: abcdef.0123456789abcdef
  before_script:
    - apt update && apt install -y openssh-client
  script:
  - ssh -i key -o StrictHostKeyChecking=no k8s@"$K8S1" "sudo ROLE=$ROLE TOKEN=$TOKEN bash -s" < scripts/install-k8s.sh
  - scp -i key -o StrictHostKeyChecking=no k8s@"$K8S1":~/hash $CI_PROJECT_DIR/hash
  rules:
  - if: $CI_COMMIT_TITLE =~ /-init$/
    when: always
  allow_failure: false
  needs:
    - deploy-cluster
  artifacts:
    paths:
      - hash
      - key
      - scripts


init-workers:
  stage: build
  image:
    name: ubuntu:latest
  variables:
    K8S1: 192.168.69.80
    K8S2: 192.168.69.81
    K8S3: 192.168.69.82
    JOINTOKEN: abcdef.0123456789abcdef
    ROLE: worker
  before_script:
    - apt update && apt install -y openssh-client
  script:
    - scp -i key -o StrictHostKeyChecking=no k8s@"$K8S1":~/hash $CI_PROJECT_DIR/hash
    - ssh -i key -o StrictHostKeyChecking=no k8s@"$K8S2" "sudo ROLE=$ROLE bash -s" < $CI_PROJECT_DIR/scripts/install-k8s.sh $K8S1 $JOINTOKEN $(cat $CI_PROJECT_DIR/hash)
    - ssh -i key -o StrictHostKeyChecking=no k8s@"$K8S3" "sudo ROLE=$ROLE bash -s" < $CI_PROJECT_DIR/scripts/install-k8s.sh $K8S1 $JOINTOKEN $(cat $CI_PROJECT_DIR/hash)
  rules:
  - if: $CI_COMMIT_TITLE =~ /-init$/
    when: always
    allow_failure: false
  needs:
    - deploy-cluster
    - init-master


deploy-metallb:
  stage: deploy
  image:
    name: alpine/k8s:1.29.13
  variables:
    K8S1: 192.168.69.80
    METALLB_NAMESPACE: metallb-system
    IP_RANGE: 192.168.69.90-192.168.69.100
  before_script:
    - apk --no-cache add openssh-client kubectl helm
  script:
    - chmod +x scripts/install-metallb.sh
    - scripts/install-metallb.sh
  rules:
    - if: '$CI_COMMIT_BRANCH == "main" && $CI_COMMIT_TITLE =~ /-init$/'
      when: always
    - when: manual
  dependencies:
    - init-master
    - init-workers


deploy-nginx:
  stage: deploy
  image:
    name: alpine/k8s:1.29.13
  variables:
    K8S1: 192.168.69.80
  before_script:
    - apk --no-cache add openssh-client
  script:
    - mkdir ~/.kube
    - scp -i key -o StrictHostKeyChecking=no k8s@"$K8S1":~/.kube/config ~/.kube/config
    - export KUBECONFIG=~/.kube/config
    - kubectl create deploy nginx --image nginx
    - kubectl expose deploy nginx --port 80 --type LoadBalancer
  rules:
  - when: always
  allow_failure: false
  dependencies:
    - init-master
    - init-workers
    - deploy-metallb


destroy-cluster:
  stage: destroy
  image: 
    name: hashicorp/terraform:latest
    entrypoint: [""]
  before_script:
    - export TF_VAR_username=$(echo "$PVEUSER" | base64 -d)
    - export TF_VAR_password=$(echo "$PVEPASSWORD" | base64 -d)
    - export PROJECT_ID=5
    - export TF_USERNAME=$(echo "$GITLABUSERNAME" | base64 -d)
    - export TF_PASSWORD=$(echo "$GITLABACCESSTOKEN" | base64 -d)
    - export TF_ADDRESS="http://git.home/api/v4/projects/$PROJECT_ID/terraform/state/proxmox-k8s-infra"
    - terraform init -backend-config=address=${TF_ADDRESS} -backend-config=lock_address=${TF_ADDRESS}/lock -backend-config=unlock_address=${TF_ADDRESS}/lock -backend-config=username=${TF_USERNAME} -backend-config=password=${TF_PASSWORD} -backend-config=lock_method=POST -backend-config=unlock_method=DELETE -backend-config=retry_wait_min=5
  script:
    - terraform destroy --auto-approve=true
  allow_failure: true
  rules:
  - when: manual
  needs: []
```

This config defines several additional jobs responsible for installing Kubernetes on our master and worker nodes, deploying MetalLB for load balancing and externalizing services, and deploying an NGINX service to the cluster for testing.

For convenience, I have included several scripts in the GitHub repository, each of which pairs with one of the CI jobs defined above.

* `install-k8s.sh` - Installs and configures Kubernetes on the master and worker nodes
* `install-metallb.sh` - Installs and configures MetalLb on the cluster

The above scripts also come paired with some YAML files, which define some Kubernetes resources required for this lab to function properly. Feel free to modify the scripts and the YAML files to suit your needs.

To summarize, we will be installing Kubernetes, initializing the cluster on the master node, joining the cluster on the worker nodes, and deploying MetalLB and NGINX to the cluster. The cluster utilizes the [Flannel](https://github.com/flannel-io/flannel) CNI to facilitate inter-node communication.

After updating your `gitlab-ci.yml` commit the changes and append `-init` to the end of your commit message. Push the changes up to main. If everything is configured correctly a new pipeline will spawn, however this time you should see 3 stages and several jobs.

The `build` and `deploy` stages will execute in sequence. The jobs within each stage will execute in parallel, respecting the constraints defined within the CI config. The `destroy` stage contains a single job which is set to `manual` so it will be skipped. To run it later, click on the play button next to it, but be warned it will tear down everything. Once completed, GitLab should indicate a successful pipeline on the UI.

<div class="blog-content-block">
    <img src="/img/blog/gitlab-ci-success-pipeline.png" />
</div>

<hr>

## Testing the deployment

Using your PVE web console, open a terminal on your master node. Alternatively, grab the RSA key from the `deploy-cluster` stage CI job [logs](https://docs.gitlab.com/administration/cicd/job_logs/) and ssh into the VM.

Our NGINX service is created in the `default` namespace in this example. Execute the following command to view it in your cluster:

```
kubectl get service -n default
```

If everything worked, you should see a `nginx` service in the output of that command. It should have been assigned an external IP by MetalLB conforming to the supplied config. Grab that external IP and enter it into your browser.

<div class="blog-content-block">
    <img src="/img/blog/k8s-nginx-service.png" />
</div>

And viola! We have an NGINX service deployed to our Kubernetes cluster, and all we had to do was push some code to `main`. 

<div class="blog-content-block">
    <img src="/img/blog/nginx-service-in-browser.png" />
</div>

<hr>

## Summary

Although the setup is long and slightly complicated when starting from scratch, it is a one time process. With GitLab, Docker, and Terraform at the core of your home lab, you can now deploy services to your Kubernetes cluster as easily as you can set up a new Git repo.

To recap what we have accomplished:

* Configured GitLab to facilitate CI/CD pipelines
* Created a repository to maintain our Kubernetes infrastructure and config
* Set up a simple load balancer in our cluster
* Deployed our first service to the cluster

Happy home-labbing!