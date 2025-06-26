# Custom Agentic Applications With LangGraph And Dockerized MCP <span style="opacity:0.5;margin:0;padding:0;font-size:14px;">- June 26, 2025</span>

In a [previous post](https://miketoscano.com/blog/?post=docker-mcp-toolkit-postgres), I detailed the simple and quick process of connecting Dockerized MCP servers from [Docker's MCP Catalog](https://www.docker.com/products/mcp-catalog-and-toolkit/) to a chatbot application like [Cursor](https://cursor.sh/), [Claude](https://claude.ai/download), or [VS Code](https://code.visualstudio.com/). 

In this post, I will show you how to leverage Docker's MCP catalog and LangChain/LangGraph to create your own agent that can think, reason, self-correct, and perform tasks on your behalf.

By the end of this guide, you will have:

* Learned the basics of LangChain
* Implemented a programmatic agent with the ability to think and act on your prompts

<hr>

## TL;DR

If you want to get things running right away, you can access the full source code on GitHub [here](https://github.com/GethosTheWalrus/docker-mcp-postgres-demo/tree/main)

You can start things up by running the following script in the root of the repository:

```bash
docker compose up --build -d postgres
docker compose run --rm chatbot
```

<hr>

## What Are Agentic Applications?

Before we build anything, we must understand what we will build. Agentic applications have the capabilities to perform tasks, often wihout human intervention. They can often reason, plan, self-correct, and act on your behalf.

Agents can have jobs, and operate most effectively when their jobs and capabilities are well defined. We will be creating our own simple agent whose job is to retrieve data from a [PostgreSQL](https://www.postgresql.org/) database on our behalf.

<hr>

## Our Agent's Background

Our fictional business is an online computer and computer part store. Customers can configure, pay for, and track orders for prebuilt gaming PCs and components. As those actions are taken by customers, our database is populated.

Rather than building reporting functionality into our website for admins, we have decided to implement an LLM-powered agent to query, analyze, and report on our store's data.

<hr>

## Architecture

For the sake of simplicity, we'll build a CLI-based chatbot application allowing our store admins to get insights on orders, items, and anything else in the database using natural language.

The system will be comprised of:

* A Dockerized Python application that accepts input via stdin and provides output via stdout
    * A LangChain ReAct agent (for reasoning)
    * LangChain MCP adapters (for tool access)
    * LangChain memory saver (for conversation state management)
* A Dockerized MCP server from the Docker MCP Catalog
* A Dockerized PostgreSQL database (to host our data)
* An Ollama instance (for LLM access)

The high-level architecture of the system is described by the Mermaid diagram below.

```mermaid
%%{init: {
  "theme": "dark"
} }%%
graph TB
    %% Core Components
    subgraph UserLayer["👥 User Interface Layer"]
        ChatInterface[💬 Chat Application<br/>Python/Streamlit/FastAPI]
    end
    
    subgraph AgentLayer["🤖 AI Agent Layer"]
        LangChainAgent[⚡ LangChain ReAct Agent<br/>- Query Planning<br/>- Multi-step Reasoning<br/>- Tool Orchestration]
        AgentMemory[💾 Conversation State<br/>MemorySaver]
    end
    
    subgraph MCPLayer["🔗 MCP Integration Layer"]
        MCPClient[📡 MCP Client<br/>langchain-mcp-adapters]
        MCPServer[🐳 MCP Server<br/>Docker Container<br/>mcp/postgres:latest]
    end
    
    subgraph DataLayer["📊 Data Layer"]
        Database[(🗄️ PostgreSQL Database<br/>Your Business Data)]
    end
    
    subgraph Infrastructure["🏗️ Infrastructure"]
        Docker[🐳 Docker Compose<br/>- Container Orchestration<br/>- Network Isolation<br/>- Service Discovery]
        LLMRuntime[🧠 LLM Runtime<br/>Ollama/OpenAI API]
    end
    
    %% Connections
    ChatInterface --> LangChainAgent
    LangChainAgent --> AgentMemory
    LangChainAgent --> MCPClient
    MCPClient -->|stdio protocol| MCPServer
    MCPServer -->|SQL queries| Database
    LangChainAgent --> LLMRuntime
    
    %% Infrastructure connections
    ChatInterface -.->|deployed in| Docker
    MCPServer -.->|managed by| Docker
    Database -.->|managed by| Docker
    
    %% Data Flow
    Database -->|results| MCPServer
    MCPServer -->|JSON response| MCPClient
    MCPClient -->|tool results| LangChainAgent
    LangChainAgent -->|formatted output| ChatInterface
```

<hr>

## Building Our Agent

Our agent will be built such that it automatically discovers and registers MCP servers and their contained tools. To achieve this, we will design a JSON schema through which we can configure arbitrary MCP servers. This makes our chatbot extendable, reusable, and flexible.

To configure an MCP server, populate the `mcpServers` object in `mcp-config.json` with tools from the Docker MCP Catalog, or with appropriate custom MCP servers.

```json
{
    "mcpServers": {
      "postgres": {
        "command": "docker",
        "args": [
          "run",
          "-i",
          "--rm",
          "--network",
          "host",
          "mcp/postgres:latest",
          "postgresql://mcp_user:mcp_password@127.0.0.1:5432/sampledb"
        ],
        "description": "PostgreSQL database"
      }
    }
} 
```

Once done, our application will attempt to start your MCP server as a subprocess, discover the tools that it contains, and make them available for use by the chatbot. You can observe how this is done [here](https://github.com/GethosTheWalrus/docker-mcp-postgres-demo/blob/d062a067791ae775d8dbd7b50b3c62e853bcff35/mcp_chatbot/src/mcp_tools.py#L12).

```python
def load_config(self):
    with open(self.config_path, 'r') as f:
        config = json.load(f)
    # Add transport if not present (default to stdio)
    for server in config.get("mcpServers", {}).values():
        if "transport" not in server:
            server["transport"] = "stdio"
    return config
```

LangChain [handles starting](https://github.com/GethosTheWalrus/docker-mcp-postgres-demo/blob/d062a067791ae775d8dbd7b50b3c62e853bcff35/mcp_chatbot/src/mcp_tools.py#L21) our MCP server for us, simplifying the process of converting our MCP config into usable tools.

```python
async def start(self):
    # The MultiServerMCPClient expects a dict of servers
    self.client = MultiServerMCPClient(self.config["mcpServers"])
    # No need to call start() - the client is ready to use
```

Upon inspection of the [agent's reasoning loop](https://github.com/GethosTheWalrus/docker-mcp-postgres-demo/blob/d062a067791ae775d8dbd7b50b3c62e853bcff35/mcp_chatbot/src/main.py#L381) within `main.py`, you can see that the app waits for the user to type a message, and processes it appropriately.

Each iteration of the run loop [invokes the agent](https://github.com/GethosTheWalrus/docker-mcp-postgres-demo/blob/d062a067791ae775d8dbd7b50b3c62e853bcff35/mcp_chatbot/src/main.py#L431), allowing it to act appropriately based on a combination of the most recently provided user input and the conversation state. 

```python
# Run the agent
result = await agent_executor.ainvoke(
    {"messages": [HumanMessage(content=user_input)]}, 
    config=tool_config
)
```

If the agent's response has been finalized, the reasoning loop is broken and a response is presented to the user. 

```python
 # Extract and show final response
if "messages" in result and result["messages"]:
    final_message = result["messages"][-1]
    if hasattr(final_message, 'content') and final_message.content:
        response = final_message.content.strip()
        # Clean up response
        if response.startswith("Agent"):
            response = response.split(":", 1)[-1].strip() if ":" in response else response
        
        print(f"{YELLOW}Agent >{RESET} {response}")
    else:
        print(f"{YELLOW}Agent >{RESET} I completed the task but don't have a specific response to share.")
else:
    print(f"{YELLOW}Agent >{RESET} I wasn't able to generate a response. Please try rephrasing your question.")
```

It is important to note that our LangChain agent is free to iterate upon the conversational context as many times as it deems necessary, within our [specified constraints](https://github.com/GethosTheWalrus/docker-mcp-postgres-demo/blob/ce738d2e3e43c04361e0bfd52cb3119ec707dea8/mcp_chatbot/src/main.py#L359). These iterations can include LLM prompts, tools calls, or a combination of the two. 

If a tool call results in an error, the agent will not necessarily exit its reasoning loop. The result will be added to the conversational context and the agent can decide to adjust its approach or finalize its response.

In the example below, we ask our agent to generate a revenue report for our fictional computer store. You will notice that we are able to ask questions about the database and get meaningful answers without needing to write a single line of SQL (our agent handles that for us).

<div class="blog-content-block">
    <iframe width="560" height="315" src="https://www.youtube.com/embed/3nhjjUwq3qE?si=9xcLMLiztC9D2mVe" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe><br>
    <span style="opacity:0.5;font-size:14px">
    📝 Note: I recommend increasing playback speed, as this demo was run using qwen3:32b on a laptop. As such, the LLM prompts are a little slow.
    </span>
</div>

Impressively, even as our agent encounters several tool errors, it is able to self-correct and eventually get us the information that we need. It is important to note that with a larger model the results would likely be even better.

<hr>

## Wrapping Up

Understanding how to utilize agentic frameworks such as LangChain and LangGraph allows you to take your AI workloads to the next level. Rather than relying on closed-source clients, you could build agentic functionality into any piece of software that you want.

Looking to play around with MCP but not ready to commit to developing your own agent? Check out my [previous post](https://miketoscano.com/blog/?post=docker-mcp-toolkit-postgres) where I show you how to connect Dockerized MCP servers directly into your chatbot of choice.

Love moonlighting as an engineer, but sick of seeing AI shoved into every piece of tech literature? Take a peek at some of my other articles about making your very own Flappy Bird game with an Oracle database.

* [Flappy Bird With JSON-Relational Duality](https://miketoscano.com/blog/?post=json-relational-duality-oracle-flappy-bird)
* [Adding A Chatroom To Flappy Bird](https://miketoscano.com/blog/?post=oracle-advanced-queue-flappy-bird)
* [Flappy Bird On The Web With OCI](https://miketoscano.com/blog/?post=oracle-oci-flappy-bird)