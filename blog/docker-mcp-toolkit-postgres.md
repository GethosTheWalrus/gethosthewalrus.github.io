# Sweet-Talk Your Database Into Revealing Its Secrets With Dockerized MCP Servers <span style="opacity:0.5;margin:0;padding:0;font-size:14px;">- July 23, 2025</span>

Docker has not-so-quietly revolutionized how we interact with AI tools through their new [MCP Toolkit](https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/), a containerized solution that enables seamless setup and management of [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) servers. If you've ever struggled with the tedious process of manually configuring MCP servers, environment dependencies, or client connections, Docker's MCP Toolkit is about to become your new best friend.

In this article, I will walk you through a practical demonstration where I connect [Cursor](https://cursor.sh/) (an AI-powered code editor) to a [PostgreSQL](https://www.postgresql.org/) database representing an online PC building store using a Dockerized MCP server.

By the end of this guide, you will have:

* Set up Docker's MCP Toolkit and connect it to a live PostgreSQL database
* Used an MCP client (like Cursor) to ask natural language questions and generate insights, no SQL required

<hr>

## What is the Docker MCP Toolkit?

The [Docker MCP Toolkit](https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/) is Docker's answer to the complexity of setting up and managing MCP servers. Rather than dealing with Python virtual environments, dependency conflicts, or manual server configurations, the toolkit provides:

* **Cross-LLM compatibility**: Works instantly with Claude Desktop, Cursor, Continue.dev, and Docker's own Gordon AI assistant
* **Zero manual setup**: No dependency management or runtime configuration required
* **Integrated tool discovery**: Browse and launch MCP servers directly from Docker Desktop
* **Security by default**: All servers run in isolated containers with resource limitations and filesystem restrictions

The toolkit functions as both an MCP server aggregator and a gateway, allowing AI clients to access multiple containerized MCP servers through a single connection point.

<hr>

## Prerequisites

Before diving into the demo, make sure you have:

* [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
* [Cursor](https://cursor.sh/) or another MCP-compatible AI client
* Basic familiarity with SQL and databases (helpful but not required)

To enable the MCP Toolkit in Docker Desktop:

1. Open Docker Desktop Settings
2. Navigate to **Beta features**
3. Enable **Docker MCP Toolkit**
4. Click **Apply & restart**

<div class="blog-content-block">
    <span style="opacity:0.5;font-size:14px">
    📝 Note: The MCP Toolkit is currently in beta and available in Docker Desktop 4.37 and later.
    </span>
</div>

<hr>

## Setting Up the PostgreSQL MCP Server

The magic begins with Docker's [PostgreSQL MCP server](https://hub.docker.com/r/mcp/postgres), a containerized tool that enables AI agents to interact with PostgreSQL databases through natural language queries.

### Installing the MCP Server

1. In Docker Desktop, click on **MCP Toolkit** in the sidebar
2. Select the **Catalog** tab
3. Find the **PostgreSQL** server and run it
4. Open the **Optional Config** menu

### Configuring Database Connection

In the Config tab, you'll need to provide your PostgreSQL connection details. For my demo, I configured it to connect to a local, Dockerized PostgreSQL instance containing sample data for a PC building store:

<div class="blog-content-block">
    <img src="/img/blog/docker-mcp-toolkit-postgres-config.png" />
</div>

Once configured, proceed to the "Clients" tab of the MCP toolkit and click "connect" next to your client of choice.

<div class="blog-content-block">
    <img src="/img/blog/docker-mcp-toolkit-client-config.png" />
</div>

Don't see the client that you want to work with, or want to bypass Docker Desktop entirely (I'm looking at you, Linux desktop users)? Open your MCP client of choice and configure a new MCP server using the settings on MCP server webpage from Docker's website.

If you want to follow along with with this guide, you can use these settings:

```json
"postgres": {
    "command": "docker",
    "args": [
    "run",
    "-i",
    "--rm",
    "--network",
    "host",
    "mcp/postgres:latest",
    "postgresql://mcp_user:mcp_password@localhost:5432/sampledb"
    ]
}
```

In cursor, your config should look like this:

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
        "postgresql://mcp_user:mcp_password@localhost:5432/sampledb"
      ]
    }
  }
}
```

If you're using VS Code with Copilot agent mode, they should look like this:

```json
{
    "mcp": {
        "inputs": [],
        "servers": {
            "postgres": {
                "command": "docker",
                "args": [
                    "run",
                    "-i",
                    "--rm",
                    "--network",
                    "host",
                    "mcp/postgres:latest",
                    "postgresql://mcp_user:mcp_password@localhost:5432/sampledb"
                ]
            }
        }
    }
}
```

If you are using Cursor, you should see something similar to the below, indicating that your MCP server is ready to use:

<div class="blog-content-block">
    <img src="/img/blog/cursor-mcp-tools-settings.png" />
</div>

## AI-Powered Business Analytics

With everything connected, lets put the system to the test by asking Cursor to analyze sales data from my fictional PC building store database. The database contains tables for:

* **Products** - CPUs, GPUs, pre-built PCs, and components
* **Orders** - Customer purchases with status tracking
* **Order Items** - Individual products within each order
* **Order Metadata** - Statuses, addresses, tracking, etc.

```mermaid
%%{init: {
  "theme": "dark"
} }%%
erDiagram
    users {
        SERIAL id PK
        VARCHAR username
        VARCHAR email
        VARCHAR password_hash
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    addresses {
        SERIAL id PK
        INTEGER user_id FK
        VARCHAR address_line1
        VARCHAR address_line2
        VARCHAR city
        VARCHAR state
        VARCHAR postal_code
        VARCHAR country
        TIMESTAMP created_at
    }

    pc_parts {
        SERIAL id PK
        VARCHAR name
        TEXT description
        VARCHAR category
        NUMERIC price
        INTEGER stock
        VARCHAR image_url
        TIMESTAMP created_at
    }

    prebuilt_pcs {
        SERIAL id PK
        VARCHAR name
        TEXT description
        NUMERIC price
        INTEGER stock
        VARCHAR image_url
        TIMESTAMP created_at
    }

    prebuilt_pc_parts {
        INTEGER prebuilt_pc_id PK, FK
        INTEGER pc_part_id PK, FK
        INTEGER quantity
    }

    orders {
        SERIAL id PK
        INTEGER user_id FK
        INTEGER address_id FK
        VARCHAR status
        NUMERIC total
        VARCHAR order_type
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    order_items {
        SERIAL id PK
        INTEGER order_id FK
        INTEGER prebuilt_pc_id FK
        INTEGER pc_part_id FK
        INTEGER quantity
        NUMERIC price
    }

    payments {
        SERIAL id PK
        INTEGER order_id FK
        VARCHAR payment_method
        VARCHAR payment_status
        NUMERIC amount
        VARCHAR transaction_id
        TIMESTAMP created_at
    }

    order_tracking {
        SERIAL id PK
        INTEGER order_id FK
        VARCHAR status
        TIMESTAMP updated_at
        VARCHAR tracking_number
    }

    carts {
        SERIAL id PK
        INTEGER user_id FK
        TIMESTAMP created_at
    }

    cart_items {
        SERIAL id PK
        INTEGER cart_id FK
        INTEGER prebuilt_pc_id FK
        INTEGER pc_part_id FK
        INTEGER quantity
    }

    reviews {
        SERIAL id PK
        INTEGER user_id FK
        INTEGER prebuilt_pc_id FK
        INTEGER rating
        TEXT comment
        TIMESTAMP created_at
    }

    users ||--o{ addresses : "has"
    users ||--o{ orders : "places"
    users ||--|| carts : "has"
    users ||--o{ reviews : "writes"
    addresses ||--o{ orders : "ships to"

    prebuilt_pcs ||--o{ prebuilt_pc_parts : "composed of"
    pc_parts ||--o{ prebuilt_pc_parts : "part of"

    prebuilt_pcs ||--o{ order_items : "in"
    pc_parts ||--o{ order_items : "in"
    
    prebuilt_pcs ||--o{ cart_items : "in"
    pc_parts ||--o{ cart_items : "in"

    prebuilt_pcs ||--o{ reviews : "has"

    orders ||--o{ order_items : "contains"
    orders ||--o{ payments : "has"
    orders ||--o{ order_tracking : "tracks"

    carts ||--o{ cart_items : "contains"
```

### First Request: Revenue Report

I started with a simple request: *"Can you generate a revenue report from my database?"*

Cursor, realizing it has a `query` tool available through the `postgres` MCP server we configured earlier, attacked the request by:

1. **Discovering the database schema** - Understanding table structures and relationships
2. **Querying and aggregating order data** - Fetching sales information across different dimensions

Here is what Cursor decided was the best way to get the context required to fulfill my request:

```json
{
  "sql": "\nSELECT\n    'Total Revenue' AS category,\n    SUM(p.amount) AS total_revenue\nFROM\n    payments p\nWHERE\n    p.payment_status = 'completed'\n\nUNION ALL\n\nSELECT\n    'Revenue by Order Type (' || o.order_type || ')' AS category,\n    SUM(p.amount) AS total_revenue\nFROM\n    payments p\nJOIN\n    orders o ON p.order_id = o.id\nWHERE\n    p.payment_status = 'completed'\nGROUP BY\n    o.order_type\n\nUNION ALL\n\nSELECT\n    'Revenue by Order Status (' || o.status || ')' AS category,\n    SUM(p.amount) AS total_revenue\nFROM\n    payments p\nJOIN\n    orders o ON p.order_id = o.id\nWHERE\n    p.payment_status = 'completed'\nGROUP BY\n    o.status;\n"
}
```

And here is the resulting context that it used to fulfill it:

```json
[
  {
    "category": "Total Revenue",
    "total_revenue": "37299.87"
  },
  {
    "category": "Revenue by Order Type (custom)",
    "total_revenue": "8099.97"
  },
  {
    "category": "Revenue by Order Type (prebuilt)",
    "total_revenue": "29199.90"
  },
  {
    "category": "Revenue by Order Status (delivered)",
    "total_revenue": "27299.91"
  },
  {
    "category": "Revenue by Order Status (processing)",
    "total_revenue": "4199.98"
  },
  {
    "category": "Revenue by Order Status (shipped)",
    "total_revenue": "5799.98"
  }
]
```

After a few seconds of consuming precious natural resources, Cursor produced this easy-to-understand revenue report:

<div class="blog-content-block">
    <img src="/img/blog/cursor-revenue-analysis.png" /> 
    <span style="opacity:0.5;font-size:14px">
    📝 Note: I'll be planting a tree to make up for the carbon emitted from this query
    </span>
</div>

### Second Request: Product Analysis & Recommendations

Impressed by the initial results, I pushed further: *"Can you analyze which of my products sell best, and recommend some targeted promotions for my customers?"*

A few brief tool calls later and my job is instantly in jeopardy, as Cursor put together several options for sales promotions in less time than it took me to heat up dinner.

<div class="blog-content-block">
    <img src="/img/blog/cursor-promotions-analysis.png" /> 
    <span style="opacity:0.5;font-size:14px">
    📝 "Yeah boss, I totally drafted this up myself. I've been slaving away over this hot keyboard for 3 weeks!"
    </span>
</div>

Again, Cursor constructs 2 queries allowing it to retrieve the context it needs from the database to answer the question:

<div class="blog-content-block">
    <span style="opacity:0.5;font-size:14px">
        ⬇️ Tool call 1
    </span>
</div>

```json
{
"sql": "\nSELECT\n    pp.name,\n    SUM(oi.quantity) AS total_quantity_sold,\n    SUM(oi.quantity * oi.price) AS total_revenue\nFROM\n    order_items oi\nJOIN\n    prebuilt_pcs pp ON oi.prebuilt_pc_id = pp.id\nWHERE\n    oi.prebuilt_pc_id IS NOT NULL\nGROUP BY\n    pp.id, pp.name\nORDER BY\n    total_revenue DESC;\n"
}
```

<div class="blog-content-block">
    <span style="opacity:0.5;font-size:14px">
        ⬇️ Results 1
    </span>
</div>

```json
[
  {
    "name": "Titan X Pro",
    "total_quantity_sold": "3",
    "total_revenue": "13099.97"
  },
  {
    "name": "Phoenix AMD Edition",
    "total_quantity_sold": "2",
    "total_revenue": "7799.98"
  },
  {
    "name": "Nova RTX 4080",
    "total_quantity_sold": "2",
    "total_revenue": "5999.98"
  },
  {
    "name": "Starter Pro",
    "total_quantity_sold": "2",
    "total_revenue": "2499.98"
  },
  {
    "name": "Stellar Gaming Pro",
    "total_quantity_sold": "1",
    "total_revenue": "2199.99"
  },
  {
    "name": "Radeon Warrior",
    "total_quantity_sold": "1",
    "total_revenue": "1899.99"
  }
]
```

<div class="blog-content-block">
    <span style="opacity:0.5;font-size:14px">
        ⬇️ Tool call 2
    </span>
</div>

```json
{
  "sql": "\nSELECT\n    p.name,\n    p.category,\n    SUM(oi.quantity) AS total_quantity_sold,\n    SUM(oi.quantity * oi.price) AS total_revenue\nFROM\n    order_items oi\nJOIN\n    pc_parts p ON oi.pc_part_id = p.id\nWHERE\n    oi.pc_part_id IS NOT NULL\nGROUP BY\n    p.id, p.name, p.category\nORDER BY\n    total_revenue DESC;\n"
}
```

<div class="blog-content-block">
    <span style="opacity:0.5;font-size:14px">
        ⬇️ Results 2
    </span>
</div>

```json
[
  {
    "name": "NVIDIA GeForce RTX 4090",
    "category": "GPU",
    "total_quantity_sold": "1",
    "total_revenue": "3299.99"
  },
  {
    "name": "NVIDIA GeForce RTX 4080 SUPER",
    "category": "GPU",
    "total_quantity_sold": "1",
    "total_revenue": "2799.99"
  },
  {
    "name": "Intel Core i9-14900K",
    "category": "CPU",
    "total_quantity_sold": "4",
    "total_revenue": "2279.96"
  },
  {
    "name": "NVIDIA GeForce RTX 4070 Ti SUPER",
    "category": "GPU",
    "total_quantity_sold": "1",
    "total_revenue": "2199.99"
  },
  {
    "name": "AMD Ryzen 5 7600X",
    "category": "CPU",
    "total_quantity_sold": "1",
    "total_revenue": "1999.99"
  }
]
```

<hr>

## What Makes This Powerful

As you can see, integrating this PostgresSQL MCP server with my environment hugely simplifies the process of visualizing my data. The ability to speak to my database in plain English not only has the potential to provide me with valuable business insights, but also the potential to help debug data-related issues during development cycles.

Empowering Cursor with the ability to see the data that my code is working with gives it the whole picture; all without having to deal with virtual environments, npm packages, or secrets management.

Docker's MCP Toolkit makes this possible and dare I say accessible to almost anyone. Dockerized MCP services provide powerful benefits including:

### Seamless Integration
No complex setup, no environment management - just install, configure, and connect. The entire process took minutes, not hours.

### Security & Isolation
The PostgreSQL MCP server runs in its own container with limited resources (1 CPU, 2GB RAM) and no filesystem access unless explicitly granted. Database credentials never leave the secure container environment.

### Natural Language Interface
Instead of writing complex SQL queries, I simply described what I wanted in plain English. The AI agent handled all the technical implementation through the MCP server, allowing me to focus on my business requirements rather than fumbling with potentially complex SQL queries or procedures.

### Tool Transparency
I could observe each MCP tool call in real-time, understanding exactly how the AI agent was interacting with my database. This transparency builds trust and enables debugging.

### Cross-Client Compatibility
The same MCP server configuration works across different AI clients - Cursor, Claude Desktop, Continue.dev, or Docker's Gordon assistant.

<hr>

### Real-World Applications

Beyond my demo, other possibile applications of containerized MCP servers include:

* **DevOps teams** using GitHub MCP servers for automated code reviews and deployment analysis
* **Marketing teams** leveraging database MCP servers for customer segmentation and campaign optimization
* **Support teams** utilizing file system MCP servers for automated documentation generation
* **Sales teams** connecting CRM databases through MCP for real-time pipeline analysis
* **Advertisers** integrating targeted, relevant ads into LLM replies

<hr>

## Looking Forward

Docker's MCP Toolkit represents a fundamental shift in how we think about AI integration. By containerizing the complexity and providing secure, standardized interfaces, Docker has made advanced AI capabilities accessible to any developer or team.

As the MCP ecosystem continues to grow, we'll likely see:

* **Enterprise-grade security features** for sensitive data handling
* **Custom MCP server development tools** for organization-specific workflows  
* **Advanced orchestration capabilities** for complex multi-tool AI workflows
* **Integration with Docker's broader AI platform** including Gordon and Model Runner

The future of AI-powered development is containerized, secure, and surprisingly simple to set up. Docker's MCP Toolkit isn't just making AI tools easier to use; it's making them accessible to everyone.

Want to see the code behind my demo? Check out my GitHub repository [here](https://github.com/GethosTheWalrus/docker-mcp-postgres-demo) for sample database schemas and MCP configurations.

*Have you tried Docker's MCP Toolkit? I'd love to hear about your experiences and use cases. Feel free to reach me at [mike@miketoscano.com](mailto:mike@miketoscano.com) and share your AI-powered workflows!*
