# Pixel - Your tiny, offline AI companion  <span style="opacity:0.5;margin:0;padding:0;font-size:14px;">- August 21, 2024</span>

This article will demonstrate how to build an AI assistant, lightweight enough to run on a Raspberry Pi 5. Utilizing [Meta's](https://about.meta.com/metaverse/) open-source [Llama](https://llama.meta.com/) 8B model, my aim is to demonstrate the accessibility of generative AI to your projects and workflows.

By the end of this guide, you will have:

* An AI companion similar to [Alexa](https://alexa.amazon.com/), [Google Assistant](https://assistant.google.com/), and [Siri](https://www.apple.com/siri/) powered by an [LLM](https://www.cloudflare.com/learning/ai/what-is-large-language-model/)
* Extended your AI companion's functionality via plugins and interceptors
* Built a [Raspberry Pi](https://www.raspberrypi.com/) based smart speaker device running Pixel

The full source code and all linked files can be found on my GitHub [here](https://github.com/GethosTheWalrus/pixel-ai-assistant). If you prefer to run things right away, you can start Pixel by following the quick-start instructions below:

* Install [Python](https://www.python.org/) 
* Clone the [repository](https://github.com/GethosTheWalrus/pixel-ai-assistant) to your machine
* Install [Ollama](https://ollama.com/) 
* Create a Python [virtual environment](https://docs.python.org/3/library/venv.html) for this project and activate it
* Run the following commands

```
ollama run llama3.1 # type /bye to exit interactive mode
cd pixel-ai-assistant
pip install -r requirements.txt # also install pi_requirements.txt on Raspberry Pi
python main.py
```

*Note, on certain platforms (arm64, etc.) you may need to install PortAudio for the PyAudio package to function properly. If you are getting PIP errors when installing PyAudio or running main.py, install [PortAudio](https://www.portaudio.com/) for your platform

<hr> 

## Purpose of Pixel

Pixel was designed to be small, extensible, easy to read, and totally offline at its core. It is designed to communicate with LLMs running with [Ollama](https://github.com/ollama/ollama) utilizing the [Ollama Python Library](https://github.com/ollama/ollama-python). 

With the ability to provide natural sounding replies to questions, you can talk to Pixel in a similar way to how you would talk to [ChatGPT](https://openai.com/chatgpt/).

It is possible to run everything that Pixel needs to operate on a single machine, disconnected from the internet (post install). 

The purpose of Pixel is to inspire developers to work AI into their projects and workflows by demonstrating how simple it can be. By providing a functioning example of something with real-world use cases, it is my hope that someone will use Pixel to build something cool. 

<hr>

## Basic Architecture

Pixel is a simple Python command line application comprised of several simple components:

* [DisplayHandler](https://github.com/GethosTheWalrus/pixel-ai-assistant/blob/main/DisplayHandler.py) - Optionally controls a 2x16 LCD display on supported platforms.
* [InterceptorHandler](https://github.com/GethosTheWalrus/pixel-ai-assistant/blob/main/InterceptorHandler.py) - Registers interceptors and handles matching on given voice prompts.
* [LanguageModelHandler](https://github.com/GethosTheWalrus/pixel-ai-assistant/blob/main/LanguageModelHandler.py) - Manages the connection with the LLM. Handles submitting prompts and getting answers to them.
* [PluginsHandler](https://github.com/GethosTheWalrus/pixel-ai-assistant/blob/main/PluginsHandler.py) - Registers plugins and handles their invocation via wake-words.
* [TextToSpeechHandler](https://github.com/GethosTheWalrus/pixel-ai-assistant/blob/main/TextToSpeechHandler.py) - Abstracts and provides intuitive access to TTS functionality.
* [VoiceHandler](https://github.com/GethosTheWalrus/pixel-ai-assistant/blob/main/VoiceHandler.py) - Handles voice capture and routes voice input to the LLM

Aside from the top-level components above, Pixel is also extensible via the [plugins](https://github.com/GethosTheWalrus/pixel-ai-assistant/tree/main/plugins) and [interceptors](https://github.com/GethosTheWalrus/pixel-ai-assistant/tree/main/interceptors) modules. 

Think of plugins as a mapping between a phrase and an action. Pixel provides an example plugin called [GetQuotePlugin](https://github.com/GethosTheWalrus/pixel-ai-assistant/blob/main/plugins/GetQuotePlugin.py), which gets a random quote from [miketoscano.com/quotes.txt](https://www.miketoscano.com/quotes.txt) and reads it to you aloud. To invoke this plugin run main.py and say, "Pixel, get me a quote".

If you'd like to create a plugin of your own, create a new file inside of the plugins folder, following the naming schema PluginNamePlugin, following the below code schema:

```
class ExamplePlugin(PixelPlugin):
    wake_phrase = "run my example plugin"

    def __init__(self, input={}):
        super().__init__(input)

    def process(self) -> str:
        # Do something here and return what you want Pixel to say as a string
```

Interceptors on the other hand are a bit more dynamic. Rather than mapping a wake phrase to a single action, interceptors are constantly listening to each voice prompt you speak to Pixel. If enough keywords are matched to a specific interceptor, its functionality will be invoked. 

Interceptors are a [RAG](https://blogs.nvidia.com/blog/what-is-retrieval-augmented-generation/-esque) pattern, augmenting your voice prompt with information from an external source, whether that source is local or somewhere remote. Pixel provides two example interceptors, the first of which augments the prompt with a simple hard-coded string:

```
class ExampleInterceptor(PixelInterceptor):
    keywords = ["what", "is", "an", "interceptor"]

    def __init__(self, voice_prompt=None):
        super().__init__(voice_prompt)

    def intercept(self) -> str:
        return "Interceptors listen to every voice prompt, " \
               "and run on relavent ones. If a particular " \
                "interceptor is matched, it will automatically " \
                "augment the prompt with relevant information " \
                "obtained from intercept method in its class."
```

If you were to ask Pixel, "Pixel, what is an interceptor?" the example above would be invoked, resulting in the following behavior:

* **Pixel hears**: pixel what is an interceptor
* **Pixel asks LLM**: what is an interceptor Interceptors listen to every voice prompt and run on relavent ones. If a particular interceptor is matched, it will automatically augment the prompt with relevant information obtained from intercept method in its class.
* **Pixel Answers**: An interceptor is a component that listens for specific voice prompts and responds accordingly. Interceptors are triggered by matching audio patterns, which can be a word, phrase, or context-specific cue. When an interceptor is matched, it adds relevant information to the original prompt using its intercept method.

As you can see, Pixel is able to answer your question despite the concept of an "interceptor" not existing outside of this project. This is because your initial prompt, "what is an interceptor", was augmented with a hard-coded definition of what an interceptor is. Pixel was provided additional context, and as such was able to give you a better answer

<div class="blog-content-block">
    <iframe width="560" height="315" src="https://www.youtube.com/embed/4I8m53IlGZ8?si=tQ4kjVTzQU4UEESQ" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>

<hr>

## Your Own Mini Pixel

As a part of this project, I have designed and modeled a small, 3D printable enclosure for Pixel with room for a [Raspberry Pi 5](https://amzn.to/4czQJqO), one [16x2 LCD display](https://amzn.to/3AyYmAr), two [30mm 2-pin fans](https://amzn.to/3YSkFeu), and a [WM8960 audio hat](https://amzn.to/3YQQCnr) (speakers and microphone). Make sure you measure before purchasing components. Measure twice, cut (or in this case, swipe your credit card) once.

You can download the model [here](https://drive.google.com/file/d/1wovctOIcdoYJRoE_2BfgHUwzdgQ91OVK/view?usp=sharing). It prints great with PLA and standard slicer profiles (tested with [Cura](https://ultimaker.com/software/ultimaker-cura/) and [Bambu Studio](https://bambulab.com/en/download/studio)).

Note that though Pixel works great on SBCs like the Raspberry Pi 5, it's much slower than a system with a supported dedicated GPU. 

Refer to the wiring diagram below for the 16x2 LCD display. The fans can be plugged into an available 3.3v (red) and ground (black) GPIO pin on your Pi.

<div class="blog-content-block">
    <img src="/img/blog/1724193805292.png" />
</div>

<div class="blog-content-block">
    <iframe width="560" height="315" src="https://www.youtube.com/embed/Rl0cvCaDte0?si=BJdFjJ0j3jisId2h" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>

<div class="blog-content-block">
    <img src="/img/blog/1724118980895.png" />
</div>

<div class="blog-content-block">
    <iframe width="560" height="315" src="https://www.youtube.com/embed/ojKtUIAdOGE?si=sYUlFAla4eQoZoC_" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>

<hr>

## Conclusion and future

Pixel is one of the coolest projects I have ever worked on. Getting to work with generative AI as a hobby without having to pay for API access or cloud hosting costs is truly game changing. 

I see a future for Pixel where it gains the ability to control smart home devices or integrate with [Home Assistant](https://www.home-assistant.io/). The possibilities are endless, and I hope to see Pixel on your desk sometime soon.

<hr>

Is generative AI not your thing? Check out some of my other articles about Flappy bird and Terraform, where I explore building containerized applications in the cloud.

* [Flappy Bird part 1](/blog/?post=json-relational-duality-oracle-flappy-bird)
* [Flappy Bird part 2](/blog/?post=oracle-advanced-queue-flappy-bird)
* [Flappy Bird part 3](/blog/?post=oracle-oci-flappy-bird)
* [Using Terraform to deploy apps to the cloud](/blog/?post=terraform-nodejs-oci-aws)
