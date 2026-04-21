# Agentic DevOps Infrastructure <span style="opacity:0.5;margin:0;padding:0;font-size:14px;">- April 21, 2026</span>

Dashboards are great at telling you _what_ is wrong. A spike in memory, a failing pod, a disk creeping toward capacity. What they don't provide is autonomous response: the ability to observe a problem, plan a remedy, and act without waiting for a human to notice and react.

This post covers the agent component of an AI DevOps platform built on **[Temporal](https://temporal.io/)** and **self-hosted LLMs via [Ollama](https://ollama.com/), or any other OpenAI compatible inference backend**.

The key technical problems this addresses are:

* **Durability -** [Temporal](https://temporal.io/) workflows keep agents alive across worker crashes, deploys, and node drains without losing state
* **Self-hosted AI -** a pluggable LLM layer that defaults to [Ollama](https://ollama.com/) on-prem, with an OpenAI-compatible path available when needed
* **Memory -** RAG-backed recall over pgvector so agents don't repeat work across cycles
* **Extensibility -** runtime tool discovery via [MCP](https://modelcontextprotocol.io/docs/getting-started/intro) so new capabilities can be added without touching the code
* **Safety -** human-in-the-loop approval gating (via Temporal [signals](https://docs.temporal.io/sending-messages)) for any action that mutates infrastructure

<hr>

## TL;DR

The source code is on GitHub [here](https://github.com/GethosTheWalrus/ai-devops).

To deploy on a cluster using the Helm chart from GHCR:

**Prerequisites:** A running Kubernetes cluster, [Helm 3](https://helm.sh/docs/intro/install/), a PostgreSQL database, and [Temporal](https://docs.temporal.io/self-hosted-guide) running in the cluster.

```bash
# Create namespace and secrets
kubectl create namespace ai-devops

kubectl create secret generic ai-devops-secrets -n ai-devops \
  --from-literal=database-url="postgres://user:pass@db-host:5432/aidevops?sslmode=disable" \
  --from-literal=jwt-secret="$(openssl rand -hex 32)" \
  --from-literal=encryption-key="$(openssl rand -hex 32)"

# Install the chart from GHCR with all configurable values
helm install ai-devops oci://ghcr.io/gethosthewalrus/charts/ai-devops \
  -n ai-devops \
  --set "image.registry=ghcr.io/gethosthewalrus/ai-devops" \
  --set "image.tag=latest" \
  --set "image.pullPolicy=Always" \
  --set "secrets.existingSecret=ai-devops-secrets" \
  --set "temporal.address=temporal-frontend.temporal:7233" \
  --set "temporal.codecEncryptionKeySecret=codec-encryption-key" \
  --set "api.replicaCount=1" \
  --set "api.monitorInterval=60s" \
  --set "worker.replicaCount=5" \
  --set "web.replicaCount=1" \
  --set "proxy.serviceType=LoadBalancer" \
  --set "persistence.enabled=true" \
  --set "persistence.size=1Gi" \
  --set "persistence.storageClassName=" \
  --set "searxng.enabled=true" \
  --set "searxng.secretKey=change-me-random-secret" \
  --set "mcpCleanup.enabled=true" \
  --set "mcpCleanup.namespace=mcp-sessions" \
  --set "mcpCleanup.schedule=0 */6 * * *" \
  --set "ingress.enabled=false" \
  --set "ingress.host=ai-devops.local"
```

Key Helm values to configure:

| Parameter | Default | Description |
|---|---|---|
| `image.registry` | `your-registry.example.com/ai-devops` | Container registry |
| `image.tag` | `latest` | Image tag |
| `api.monitorInterval` | `60s` | Server metric polling interval |
| `worker.replicaCount` | `5` | Temporal worker replicas |
| `proxy.serviceType` | `LoadBalancer` | Proxy service type |
| `temporal.address` | `temporal-frontend.temporal:7233` | Temporal frontend address |
| `secrets.existingSecret` | `""` | Existing K8s secret with `database-url`, `jwt-secret`, `encryption-key` |
| `persistence.size` | `1Gi` | PVC size for API data |
| `ingress.enabled` | `false` | Enable Ingress (alternative to LoadBalancer) |

<hr>

## What the Platform Does

Most AI integrations in DevOps are fire-and-forget: a chatbot explains a log, answers, and the context is gone. This platform is different.

Each agent owns a slice of infrastructure (a specific Kubernetes namespace, a set of servers, or a database cluster). It has its own system prompt, its own memory, its own todo list, and its own approval queue for destructive actions. Agents run continuously, waking on a configurable interval to observe, plan, and act.

![Agent dashboard for the Temporal operator agent](../img/blog/agent-hub-dashboard-temporal-operator.png)

<hr>

## Architecture

The system is built around horizontal scalability and durability. Workers poll a Temporal task queue; scaling up means adding worker replicas. Here's the big picture:

```mermaid
%%{init: {
  "theme": "dark"
} }%%
graph TD
    subgraph UserLayer["👥 User Interface Layer"]
        Hub[Agents Dashboard]
        Approvals[Approval Queue]
        Instruct[Instruction Input]
    end

    subgraph APILayer["🚀 Go API"]
        Handler[Agent Handlers]
    end

    subgraph TemporalLayer["⏳ Temporal Cluster"]
        TQ[Task Queue]
        History[(Workflow History)]
    end

    subgraph WorkerLayer["👷 Worker Pool"]
        W1[Worker 1]
        W2[Worker 2]
        W3[Worker N...]
    end

    subgraph DataLayer["📊 Persistence and External"]
        PG[(PostgreSQL)]
        Vec[(pgvector)]
        LLM[LLM Backend]
        MCP[MCP Tool Servers]
        Targets[Managed Infra]
    end

    Hub --> Handler
    Approvals --> Handler
    Instruct --> Handler
    Handler --> TQ
    TQ --- History
    TQ --- W1
    TQ --- W2
    TQ --- W3
    W1 --> PG
    W1 --> Vec
    W1 --> LLM
    W1 --> MCP
    W1 --> Targets
    Handler --> PG
```
<br>

The LLM backend is **self-hosted by default**. Agents handle sensitive material such as server hostnames, credentials in command output, internal topology, log excerpts. Sending that to a third-party API is a non-starter. The platform connects to a configurable inference backend server and runs local models of your choosing.

The `callLLM` dispatcher in `ai.go` makes the backend fully pluggable. It detects Ollama by port (`:11434`) and routes to the native `/api/generate` endpoint, which correctly respects `num_ctx`. Everything else goes to the OpenAI-compatible `/v1/chat/completions` path, useful for swapping in vLLM, LM Studio, or a hosted provider during development. Swapping models or backends is a config change, not a code change:

```go
func callLLM(ctx context.Context, llmURL, backend, prompt, model string) (string, string, error) {
    if model == "" {
        model = "gemma3:12b"
    }

    if strings.Contains(llmURL, ":11434") {
        return callOllama(ctx, llmURL, prompt, model)
    }

    switch backend {
    case "openai":
        return callOpenAI(ctx, llmURL, prompt, model)
    default:
        return callOllama(ctx, llmURL, prompt, model)
    }
}
```

<hr>

## Temporal as the Agent Runtime

The central architectural decision is using **Temporal** as the orchestration layer rather than background goroutines, LangChain, or cron jobs.

With goroutines or cron, a process crash mid-task means losing everything: the agent's current reasoning, the tool call it was about to make, all of it. With Temporal, every agent runs as a `RunAgentLoop` workflow. If a worker crashes, Temporal replays the history and resumes exactly where it left off. For agents that run for weeks, this durability is non-negotiable, and helps us avoid having to rely on in-memory solutions.

### Two run modes

The workflow supports two modes:

1. **Continuous:** loops indefinitely, sleeping for a configurable `cycle_interval` between cycles
2. **Bounded:** runs up to `MaxTurns` then exits, useful for one-off diagnostics

### The infinite history problem

A continuous agent running for weeks would eventually overwhelm Temporal's workflow history. The solution is `workflow.NewContinueAsNewError`: at the end of every cycle, the workflow restarts itself with a clean history, carrying forward only the essential state. The agent keeps running semantically, but the event log stays bounded.

![Agent loop and approval workflows running in Temporal](../img/blog/agent-loop-and-approvals-in-temporal.png)

### The agent loop

The core of the agent loop is in `RunAgentLoop`. Once the LLM signals it's done with a cycle, the workflow writes the journal entry, sleeps for the configured interval, then issues `ContinueAsNew`:

<details style="margin:20px 0;">
<summary style="background:#2d3748;color:#e2e8f0;padding:8px 12px;border-radius:6px 6px 0 0;font-family:'SF Mono',Monaco,'Cascadia Code','Roboto Mono',Consolas,'Courier New',monospace;font-size:13px;border:1px solid #4a5568;border-bottom:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
<span>{} RunAgentLoop: cycle end and ContinueAsNew</span>
<span style="opacity:0.6;font-size:11px;">Click to expand</span>
</summary>
<div style="background:#1a202c;border:1px solid #4a5568;border-radius:0 0 6px 6px;margin:0;padding:0;overflow:hidden;">
<div style="background:#2d3748;color:#e2e8f0;padding:4px 12px;font-family:'SF Mono',Monaco,'Cascadia Code','Roboto Mono',Consolas,'Courier New',monospace;font-size:11px;border-bottom:1px solid #4a5568;display:flex;justify-content:space-between;align-items:center;">
<span>Go</span>
<span style="opacity:0.6;">worker/workflows/agent.go</span>
</div>

```go
// Agent decided it's done with this cycle
if decision.Done {
    // Write cycle journal entry (only for continuous / named agents)
    if input.AgentID != "" {
        journalCtx := workflow.WithActivityOptions(ctx, llmOpts)
        workflow.ExecuteActivity(journalCtx, "AgentWriteJournal", activities.AgentWriteJournalInput{
            AgentID:     input.AgentID,
            Turns:       turns,
            Summary:     decision.Summary,
            CycleMemory: input.CycleMemory,
            AIModel:     input.AIModel,
            LLMURL:      input.LLMURL,
            LLMBackend:  input.LLMBackend,
        }).Get(ctx, nil)
    }

    if input.Continuous {
        // Sleep before starting the next cycle, then ContinueAsNew
        _ = workflow.Sleep(ctx, cycleSleep)
        // ContinueAsNew clears workflow history to prevent unbounded growth
        input.Instructions = instructions
        return nil, workflow.NewContinueAsNewError(ctx, "RunAgentLoop", input)
    }

    return &AgentLoopResult{
        Fixed:   decision.Fixed,
        Summary: decision.Summary,
        Turns:   turns,
    }, nil
}
```

</div>
</details>

Temporal's signal mechanism is also used to inject operator instructions into a live agent. Before every turn, the workflow non-blockingly drains any pending `agent-instruction` signals. Instructions sent from the UI are picked up at the next turn boundary without interrupting the current cycle:

<details style="margin:20px 0;">
<summary style="background:#2d3748;color:#e2e8f0;padding:8px 12px;border-radius:6px 6px 0 0;font-family:'SF Mono',Monaco,'Cascadia Code','Roboto Mono',Consolas,'Courier New',monospace;font-size:13px;border:1px solid #4a5568;border-bottom:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
<span>{} Signal draining: injecting instructions into a live agent</span>
<span style="opacity:0.6;font-size:11px;">Click to expand</span>
</summary>
<div style="background:#1a202c;border:1px solid #4a5568;border-radius:0 0 6px 6px;margin:0;padding:0;overflow:hidden;">
<div style="background:#2d3748;color:#e2e8f0;padding:4px 12px;font-family:'SF Mono',Monaco,'Cascadia Code','Roboto Mono',Consolas,'Courier New',monospace;font-size:11px;border-bottom:1px solid #4a5568;display:flex;justify-content:space-between;align-items:center;">
<span>Go</span>
<span style="opacity:0.6;">worker/workflows/agent.go</span>
</div>

```go
instructionCh := workflow.GetSignalChannel(ctx, "agent-instruction")
drainInstructions := func() {
    for {
        var sig InstructionSignal
        ok := instructionCh.ReceiveAsync(&sig)
        if !ok {
            break
        }
        if sig.Instruction != "" {
            instructions = append(instructions, sig.Instruction)
        }
    }
}
drainInstructions()
```

</div>
</details>

Here's the visual flow of a full cycle:

![Agent loop workflow details in the Temporal UI](../img/blog/proxmox-agent-loop-workflow-in-temporal.png)

<div class="no-panzoom">

```mermaid
%%{init: {
  "theme": "dark"
} }%%
flowchart TD
    Start([RunAgentLoop starts]) --> Refresh[AgentRefreshState<br>load todos/insights/journal]
    Refresh --> MCPCheck{MCP servers<br>configured?}
    MCPCheck -->|yes| Discover[AgentListMCPTools<br>spin up ephemeral pods]
    MCPCheck -->|no| TurnStart
    Discover --> LogDisc[AgentLogActivity<br>tools discovered]
    LogDisc --> TurnStart[Begin Turn Loop]

    TurnStart --> ReviewChk{actionTurns %<br>5 == 0?}
    ReviewChk -->|yes| Review[AgentReviewTodos<br>re-evaluate todo list]
    ReviewChk -->|no| Drain
    Review --> Drain[Drain instruction signals]
    Drain --> Refresh2[AgentRefreshState<br>mid-cycle refresh]
    Refresh2 --> Compact{turn tokens<br>> 40K?}
    Compact -->|yes| DoCompact[AgentCompactConversation<br>summarize old turns]
    Compact -->|no| RAG
    DoCompact --> RAG[AgentSearchEmbeddings<br>RAG retrieval]
    RAG --> Decide[AgentDecideStep<br>LLM picks next tool]

    Decide --> Done{done?}
    Done -->|yes| Journal[AgentWriteJournal +<br>AgentEmbedAndStore]
    Done -->|no| Tool[Execute chosen tool<br>as activity]

    Tool --> Append[Append LoopTurn<br>to history]
    Append -->     MaxChk{turn under<br>MaxTurns?}
    MaxChk -->|yes| TurnStart
    MaxChk -->|no| Journal

    Journal --> Continuous{Continuous<br>mode?}
    Continuous -->|yes| Sleep[workflow.Sleep<br>cycleInterval]
    Continuous -->|no| Return([return result])
    Sleep --> CAN[ContinueAsNew<br>reset history]
    CAN --> Start
```

</div>

<hr>

## Agent State and Memory

For agents to operate autonomously without constant prompting, they need persistent state and long-term memory.

### Persistent state

A Postgres-backed state block is maintained per agent, scoped entirely to that agent:

* **`agent_todos`:** planned work with status, priority, and plan steps
* **`agent_insights`:** recurring findings, deduplicated by summary with severity tracking
* **`agent_activities`:** full audit log of every action, including tool discovery and failures
* **`agent_thoughts`:** raw turn-by-turn reasoning and tool I/O
* **`agents.journal`:** LLM-summarized cycle retrospectives

<br>

State is refreshed from the database at cycle start and again before each turn, so the agent is always working from current data even if approvals were resolved or new todos were created mid-cycle.

### Long-term memory via RAG

Each turn, the current problem and most recent reasoning are embedded and used to run a cosine similarity search against `agent_embeddings` (backed by `pgvector`, 768-dim). This surfaces relevant context from previous cycles; an agent can recall that it already restarted a service last Tuesday and skip redundant investigation.

At the end of each cycle, the journal entry is written and embedded. The next cycle's RAG query will surface it.

### The system prompt

Each turn, `AgentDecideStep` assembles the full prompt and calls the LLM. The `agentLoopPrompt` constant defines the agent's mission, the one-tool-per-turn protocol, the approval rules, and the exact JSON response schema the agent must follow:

<details style="margin:20px 0;">
<summary style="background:#2d3748;color:#e2e8f0;padding:8px 12px;border-radius:6px 6px 0 0;font-family:'SF Mono',Monaco,'Cascadia Code','Roboto Mono',Consolas,'Courier New',monospace;font-size:13px;border:1px solid #4a5568;border-bottom:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
<span>{} agentLoopPrompt - the agent's operating instructions</span>
<span style="opacity:0.6;font-size:11px;">Click to expand</span>
</summary>
<div style="background:#1a202c;border:1px solid #4a5568;border-radius:0 0 6px 6px;margin:0;padding:0;overflow:hidden;">
<div style="background:#2d3748;color:#e2e8f0;padding:4px 12px;font-family:'SF Mono',Monaco,'Cascadia Code','Roboto Mono',Consolas,'Courier New',monospace;font-size:11px;border-bottom:1px solid #4a5568;display:flex;justify-content:space-between;align-items:center;">
<span>Go</span>
<span style="opacity:0.6;">worker/activities/agent.go</span>
</div>

```go
const agentLoopPrompt = `You are an expert DevOps engineer continuously monitoring and managing a homelab infrastructure.
Your mission is to keep the lab running and stable. You run continuously in the background,
gathering state, diagnosing issues, and taking corrective action.

Key principles:
- ALWAYS seek approval via request_approval before making ANY changes to the environment
  (restarts, scaling, config changes, pod deletions, etc.). The action will execute
  automatically once approved - you do not need to wait.
- Track your work using todos: create them for issues you discover, update them when resolved.
- Record insights for trends and patterns you observe.
- Log significant actions to the audit trail.

Available servers:
%s
Available tools:
%s
Respond with ONLY valid JSON in one of these forms:

To use a tool:
{"tool": "<tool_name>", "reasoning": "Why you are doing this", "params": {<tool-specific params>}}

When finished with this monitoring cycle:
{"tool": "done", "reasoning": "Summary of what you found and did",
 "params": {"fixed": true/false, "summary": "What was done and the outcome"}}

Rules:
- ONE tool per turn. You will see the result before your next decision.
- Start with gather_state to understand the current system health.
- Use run_command for deeper investigation (logs, describe, exec).
  Read-only commands execute instantly; mutating commands will automatically
  require human approval - you do NOT need to call request_approval separately
  for run_command.
- NEVER run catastrophically destructive commands (rm -rf /, etc.).
- Do NOT create duplicate todos or insights - check the existing state first.
- BEFORE calling "done", you MUST call update_todo for every todo you actively
  worked on during this cycle. This is required - do not skip it.`
```

</div>
</details>

### MCP tool discovery

Rather than hardcoding every possible DevOps operation, tool discovery uses **Model Context Protocol**. Each agent has its own list of MCP servers attached to it in the database. Any Dockerized MCP server (published to a registry the cluster can pull from) can be wired to any agent, with its own image, env vars, and args. One agent might get a Kubernetes MCP server and a Prometheus MCP server; another might get a Postgres MCP server and nothing else. Capabilities are scoped per agent, not globally.

When an agent has MCP servers configured, they are spun up as ephemeral pods on a designated Kubernetes control plane. The agent discovers their tools at runtime and the catalog is injected into the system prompt. This facilitates a proper plugin architecture where new capability packs can be attached without touching the code.

Each MCP server runs as an ephemeral `kubectl run --rm -i` pod. The worker SSHs into the control plane, starts the pod, and communicates via JSON-RPC over the pod's stdin/stdout pipe. `buildKubectlRunCmd` constructs the pod launch command, injecting environment variables and args from the server definition:

```go
func buildKubectlRunCmd(mcp MCPServerDef) string {
    safeName := strings.NewReplacer("_", "-", "/", "-", ":", "-", ".", "-", " ", "-").
        Replace(strings.ToLower(mcp.Name))
    podName := fmt.Sprintf("mcp-%s-%d", safeName, time.Now().UnixNano()%1000000)
    parts := []string{
        "kubectl", "run", podName,
        "--rm", "-i", "--restart=Never",
        "--image=" + mcp.Image,
        "--image-pull-policy=IfNotPresent",
        "--quiet",
        "--namespace=mcp-sessions",
    }
    for k, v := range mcp.Env {
        sanitized := strings.ReplaceAll(v, "'", "'\\''")
        parts = append(parts, fmt.Sprintf("--env='%s=%s'", k, sanitized))
    }
    if len(mcp.Args) > 0 {
        parts = append(parts, "--")
        for _, arg := range mcp.Args {
            sanitized := strings.ReplaceAll(arg, "'", "'\\''")
            parts = append(parts, "'"+sanitized+"'")
        }
    }
    return strings.Join(parts, " ")
}
```

Once the pod is running, the worker performs the MCP handshake (`initialize`, `notifications/initialized`, `tools/list`) and returns the tool catalog to the workflow. The tools are injected directly into the agent's prompt for the current cycle.

<hr>

## Tool Catalog and Human-in-the-Loop Approvals

Every tool an agent can call falls into one of three buckets:

1. **Read-only** - `gather_state`, `list_todos`, `web_search`, `fetch_webpage`. Always allowed, no approval needed.
2. **State-mutating** - `create_todo`, `update_todo`, `create_insight`, `log_activity`. These manage the agent's own workflow state.
3. **Gated** - mutating `run_command`, any structured action like `restart_deployment`. These require human approval before execution.

When a gated tool is selected, a Temporal child workflow (`RunApprovalAction`) is spawned with `ParentClosePolicy: ABANDON`. The child waits up to 24 hours for a signal from the UI. The parent agent does not block; it continues its cycle or sleeps, and the approval executes independently.

![Agent hub dashboard showing pending approvals](../img/blog/agent-hub-dashboard-with-approvals.png)

The read-only check is a prefix list. Any `run_command` whose command matches a known safe prefix runs immediately; anything else auto-triggers the approval flow:

```go
var readOnlyPrefixes = []string{
    "cat ", "head ", "tail ", "less ", "more ",
    "ls ", "ls\n", "find ", "stat ", "file ", "du ", "df ", "df\n",
    "ps ", "top ", "uptime", "free ", "free\n", "vmstat", "iostat",
    "netstat", "ss ", "ss\n", "lsof ",
    "kubectl get ", "kubectl describe ", "kubectl logs ", "kubectl top ",
    "docker ps", "docker logs ", "docker inspect ", "docker images",
    "systemctl status ", "systemctl is-active ", "systemctl list-",
    "journalctl ",
    "grep ", "awk ", "cut ", "echo ", "date", "hostname", "uname",
    // ... and more
}

func isReadOnlyCommand(cmd string) bool {
    trimmed := strings.TrimSpace(cmd)
    bare := trimmed
    if strings.HasPrefix(bare, "sudo ") {
        bare = strings.TrimSpace(bare[5:])
    }
    for _, prefix := range readOnlyPrefixes {
        if strings.HasPrefix(bare, prefix) || bare == strings.TrimSpace(prefix) {
            return true
        }
    }
    return false
}
```

The approval child workflow uses a Temporal `Selector` to wait on either the `approval-decision` signal or a 24-hour timeout, whichever arrives first:

<details style="margin:20px 0;">
<summary style="background:#2d3748;color:#e2e8f0;padding:8px 12px;border-radius:6px 6px 0 0;font-family:'SF Mono',Monaco,'Cascadia Code','Roboto Mono',Consolas,'Courier New',monospace;font-size:13px;border:1px solid #4a5568;border-bottom:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
<span>{} RunApprovalAction - wait for human signal, then execute</span>
<span style="opacity:0.6;font-size:11px;">Click to expand</span>
</summary>
<div style="background:#1a202c;border:1px solid #4a5568;border-radius:0 0 6px 6px;margin:0;padding:0;overflow:hidden;">
<div style="background:#2d3748;color:#e2e8f0;padding:4px 12px;font-family:'SF Mono',Monaco,'Cascadia Code','Roboto Mono',Consolas,'Courier New',monospace;font-size:11px;border-bottom:1px solid #4a5568;display:flex;justify-content:space-between;align-items:center;">
<span>Go</span>
<span style="opacity:0.6;">worker/workflows/agent.go</span>
</div>

```go
func RunApprovalAction(ctx workflow.Context, input ApprovalActionInput) (*ApprovalActionResult, error) {
    signalCh := workflow.GetSignalChannel(ctx, "approval-decision")

    var signal ApprovalSignal
    timerCtx, timerCancel := workflow.WithCancel(ctx)
    timerFuture := workflow.NewTimer(timerCtx, 24*time.Hour)

    selector := workflow.NewSelector(ctx)

    var received bool
    selector.AddReceive(signalCh, func(c workflow.ReceiveChannel, more bool) {
        c.Receive(ctx, &signal)
        received = true
        timerCancel()
    })
    selector.AddFuture(timerFuture, func(f workflow.Future) {
        // Timer fired - approval timed out
    })
    selector.Select(ctx)

    if !received {
        return &ApprovalActionResult{Executed: false, Output: "Approval timed out after 24 hours"}, nil
    }
    if !signal.Approved {
        return &ApprovalActionResult{Executed: false, Output: "Rejected by human operator"}, nil
    }

    // Approved - execute the action
    var result activities.AgentExecOutput
    err := workflow.ExecuteActivity(actCtx, "AgentExecAction", activities.AgentExecInput{
        Action:       input.Action,
        ResourceKind: input.ResourceKind,
        ResourceName: input.ResourceName,
        Params:       input.Params,
        ServerID:     input.ServerID,
    }).Get(ctx, &result)
    // ...
}
```

</div>
</details>

The `AgentRequestApproval` activity also contains dedup logic. Before inserting a new approval record, it checks for a pending approval for the same action and resource, and whether the same action was rejected within the last hour. This prevents the agent from flooding the approval queue across cycles:

```go
// Skip if pending approval already exists for same action+resource
var existingID string
err := a.DB.QueryRowContext(ctx,
    `SELECT id FROM agent_approvals
     WHERE agent_id=$1 AND action=$2 AND resource_name=$3 AND status='pending'`,
    input.AgentID, input.Action, input.ResourceName).Scan(&existingID)
if err == nil && existingID != "" {
    return &AgentRequestApprovalOutput{
        ApprovalID: existingID,
        Message:    fmt.Sprintf("Approval already pending: %s (id: %s)", input.Action, existingID),
        Success:    true,
    }, nil
}

// Also skip if same action+resource was rejected within the last hour
var rejectedID string
err = a.DB.QueryRowContext(ctx,
    `SELECT id FROM agent_approvals
     WHERE agent_id=$1 AND action=$2 AND resource_name=$3
       AND status='rejected' AND resolved_at > NOW() - INTERVAL '1 hour'
     ORDER BY resolved_at DESC LIMIT 1`,
    input.AgentID, input.Action, input.ResourceName).Scan(&rejectedID)
if err == nil && rejectedID != "" {
    return &AgentRequestApprovalOutput{
        Message: fmt.Sprintf("Approval for %s on %s was recently rejected - not re-requesting",
            input.Action, input.ResourceName),
        Success: true,
    }, nil
}
```

```mermaid
%%{init: {
  "theme": "dark"
} }%%
flowchart TD
    subgraph AgentProcess["Agent Logic"]
        Pick[LLM picks mutating action]
        Req[Request Approval Activity]
        Child[Start Approval Child Workflow]
        AgentContinue[Agent continues cycle/sleeps]
    end

    subgraph UserProcess["Human Approval"]
        UserUI[User approves in UI]
        API[API updates DB]
    end

    subgraph Execution["Action Execution"]
        Signal[Signal Child Workflow]
        Run["Execute Action (SSH/kubectl)"]
        Log[Log Activity & Results]
    end

    Pick --> Req
    Req --> Child
    Child --> AgentContinue
    
    UserUI --> API
    API --> Signal
    Signal --> Run
    Run --> Log
```

<hr>

## An Example Cycle

A typical cycle, end to end:

1. **Wake up.** The agent refreshes its state from Postgres: todos, insights, open approvals, journal entries.
2. **Discover.** MCP servers are queried. A tool for managing Kubernetes namespaces is discovered and added to the prompt.
3. **Observe.** The LLM calls `gather_state` across its servers. High memory usage is detected on `db-01`.
4. **Plan.** `create_todo` is called ("Investigate memory leak on db-01") and `create_insight` records the trend.
5. **Propose.** The LLM selects `run_command: systemctl restart postgres-exporter`. This command is not in the read-only prefix list, so an approval record is created and a `RunApprovalAction` child workflow is spawned.
6. **Human approves.** An engineer reviews the request in the UI and approves it.
7. **Execute.** The child workflow receives the `approval-decision` signal, runs the command via SSH, logs the result, and completes independently.
8. **Reflect.** At cycle end, the agent writes a journal summary and embeds it. The next cycle's RAG query surfaces the entry - the agent knows the exporter was already restarted and skips redundant investigation.

<hr>

## Summary

Autonomous infrastructure management requires more than a capable LLM; it requires several layers, each solving a distinct problem:

* **Orchestration (Temporal)** enabling durability, consistency, and organizational capabilities to our agents
* **Inference backend (Ollama)** providing text generation and prompt processing, the heart of each agent
* **Memory (pgvector)** providing long-living state across agent cycles, ensuring our agent learns from its past experiences managing our lab
* **Tools (MCP)** which dynamically expand our agents' sets of capabilities
* **Safety (Temporal signals)** via Temporal signals, ensuring our agents don't destroy out infrastructure without our permission 

<br>

Related posts:

* [Custom Agentic Applications With LangGraph And Dockerized MCP](https://miketoscano.com/blog/?post=docker-mcp-langgraph-agent)
* [Building Agentic Workflows With LangChain And Temporal](https://miketoscano.com/blog/?post=langchain-temporal-workflow-processor)
