# Maintaining Docker image security with Docker Scout <span style="opacity:0.5;margin:0;padding:0;font-size:14px;">- November 25, 2024</span>

The purpose of this article is to provide an introduction to Docker Scout, and to demonstrate how to use it to gain insights on the security posture of your application stack.

## What is Docker Scout?

[Docker Scout](https://docs.docker.com/scout/) is a platform and service that helps improve the security of software supply chains by analyzing your Docker images and providing detailed information about their security postures.

It both enhances your development process with detailed image analysis and provides proactive remediation tools. It all integrates seamlessly with Docker Desktop and provides an organization level view from both a security and compliance perspective.

<hr>

## Getting Started

For the following example, I'll be referring back to one of my [previous articles](/blog/?post=oracle-oci-flappy-bird) where I showed you how to deploy a Dockerized Flappy Bird game locally using [Docker Compose](https://docs.docker.com/compose/) and to the cloud in [OCI](https://www.oracle.com/cloud/) with [Terraform](https://www.terraform.io/). 

To get started, clone the [repo](https://github.com/GethosTheWalrus/game-backend-oracle-db) from my [GitHub page](https://github.com/GethosTheWalrus). We'll be using the node-app Docker image for this example, so lets build that using Docker Compose by entering the following command in your terminal:

```
docker-compose build
```

Open up [Docker Desktop](https://www.docker.com/products/docker-desktop/), and you should see the image on your images tab.

<div class="blog-content-block">
    <img src="/img/blog/1732559717461.png" />
</div>

Click on "Docker Scout" on the menu bar to the left. You'll be greeted with the following screen, allowing you to "Analyze image".

<div class="blog-content-block">
    <img src="/img/blog/1732559803602.png" />
</div>

Clicking that button will cause Docker Scout to analyze each layer of your our Docker image for potential vulnerabilities, poor practices, and (in the context of an organization) compliance violations. 

On the right half of the screen, there's a tab for images, vulnerabilities, and packages. Clicking on the images tab will give you a view of the different images that your final image is comprised of, and how many issues exist within each of them. The vulnerabilities tab provides a more granular view, showing the specific package containing each vulnerability, and which [CVEs](https://nvd.nist.gov/vuln) they are related to.

<div class="blog-content-block">
    <img src="/img/blog/1732560642085.png" />
</div>

<hr>

## Using the feedback to remediate vulnerabilities

Yikes. Things are looking a little red for our Flappy Bird backend. Let's make some quick and easy changes based on the feedback we got from Scout.

Looking at the Images tab of our Scout feedback, it looks like both the Alpine and Node images that we're using contain a critical vulnerability. Fortunately, Scout has detected a new version of the node image.

Looking at the [Dockerhub page](https://hub.docker.com/_/node) for the official Node.js image, the most up-to-date LTS image is [22.11-alpine3.19](https://github.com/nodejs/docker-node/blob/b0de582b8d4627cc9d65a89bf3af1bfcf67d2bef/22/alpine3.19/Dockerfile), at the time of writing. Let's update the Dockerfile for our node-app service, rebuild, and re-analyze the image. 

<div class="blog-content-block">
    <img src="/img/blog/1732561377709.png" />
</div>

You will notice that the Scout summary for our image has automatically updated, and with good news to boot! It looks like the critical vulnerability is gone. That's a lot of additional value attached to your workflow with virtually zero extra work.
Conclusion

Without Docker Scout, we may have discovered these vulnerabilities in our application when they were exploited by bad actors, rather than during development. 

Application security is often overlooked, forcing our firewalls, IPS devices, etc. to work constant overtime. With tools like Docker Scout, you can bring a unique and coveted security-first mentality to your next company and/or team.

<hr>

## Follow up topics

* Docker Scout CLI
* Docker Scout for organizations
* Integrating with CI/CD pipelines 

