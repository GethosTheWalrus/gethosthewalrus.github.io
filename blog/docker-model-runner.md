# Whale-Sized Intelligence - Running LLMs with Docker Desktop <span style="opacity:0.5;margin:0;padding:0;font-size:14px;">- March 27, 2025</span>

[Docker](https://www.docker.com/) has quietly launched something really exciting: the Docker Model Runner, a new feature built into Docker Desktop (macOS on [Apple Silicon](https://support.apple.com/en-us/116943) only, for now) that lets you pull, run, and interact with [LLMs](https://www.nvidia.com/en-us/glossary/large-language-models/) (Large Language Models) — all from the CLI or your apps, just like you would with containers. No Python environments, no [CUDA](https://developer.nvidia.com/cuda-toolkit) drama, just docker model run.

Want to see some code in action? check out my repository [here](https://github.com/GethosTheWalrus/-docker-model-runner-test) to see an example of how to call Docker Model Runner from a Python script.

## 🚀 Prerequisites

First, make sure you're on one of the supported[ Docker Desktop](https://www.docker.com/products/docker-desktop/) builds, the first of which is slated to release this coming Monday (March 31st, 2025).

Then, enable the Model Runner by going to:

Docker Desktop → Settings → Features in Development → Beta Features → Enable Model Runner

Click Apply & Restart.

<div class="blog-content-block">
    <img src="/img/blog/docker_desktop_setup.png" />
    <span style="opacity:0.5;font-size:14px">
    ⚠️ This feature currently only works on macOS with Apple Silicon, however Windows support is coming at a future date.
</span>
</div>

# 🛠️ Using the Docker Model Runner CLI

Once enabled, a new CLI command is at your disposal: `docker model`.

## ✅ Check if it's running
```
docker model status
```

Expected output:
```
Docker Model Runner is running
```

<hr>

## 🔍 View available commands
```
docker model help
```

You'll see commands like:

* list – List available models
* pull – Download a model
* rm – Remove a model
* run – Run a model
* status – Check if it’s running
* version – Show the version

<hr>

## 📦 List available models
```
docker model list | jq .
```

If no models are pulled yet, you will see an empty array.

<hr> 

## ⬇️ Pull a model
```
docker model pull ignaciolopezluna020/llama3.2:1b
```

You should see your [model](https://hub.docker.com/r/ignaciolopezluna020/llama3.2) download, and can verify that it downloaded by executing `docker model list`

<div class="blog-content-block">
    <img src="/img/blog/pull_model.png" />
</div>

<hr>

## 💬 Run the model

One-shot response:
```
docker model run ignaciolopezluna020/llama3.2:1b "Hi"
```

Interactive chat mode:
```
docker model run ignaciolopezluna020/llama3.2:1b
```

In interactive mode, you can freely chat with your chosen model. Type your message and exit with /bye.

<div class="blog-content-block">
    <iframe width="315" height="560"
    src="https://www.youtube.com/embed/GWY-gs_rZNg"
    title="YouTube video player"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen></iframe>
</div>

<hr>

💡 Interact with the Model Runner via OpenAI API

Once a model is running, you can also use OpenAI-compatible APIs.

🔗 From inside another container:
```
curl http://ml.docker.internal/ml/llama.cpp/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ignaciolopezluna020/llama3.2:1b",
    "messages": [
      {
        "role": "system",
        "content": "You are a helpful assistant."
      },
      {
        "role": "user",
        "content": "Please write 500 words about the fall of Rome."
      }
    ]
  }'
```

🔌 From the host using a Unix socket:
```
curl --unix-socket $HOME/.docker/run/docker.sock \
  localhost/exp/vDD4.40/ml/llama.cpp/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ignaciolopezluna020/llama3.2:1b",
    "messages": [
      {
        "role": "system",
        "content": "You are a helpful assistant."
      },
      {
        "role": "user",
        "content": "Please write 500 words about the fall of Rome."
      }
    ]
  }'
```

<hr>

## 🧹 Remove a model
```
docker model rm ignaciolopezluna020/llama3.2:1b
```

You should see a message indicating that your model has been removed successfully.

<div class="blog-content-block">
    <img src="/img/blog/remove_model.png" />
</div>

<hr>

## 🧭 Final Thoughts

The Docker Model Runner makes it ridiculously easy to experiment with LLMs locally. No dependencies. No [Ollama](https://ollama.com/) drama. Just docker model run. As the ecosystem matures, expect better model variety, support for more platforms, and tighter integration into the Docker developer workflow.

Whalecome to the future of containerized AI. 🐳✨