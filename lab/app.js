const details = {
    proxmox1: d("PHYSICAL / HYPERVISOR", "proxmox1", "Single-node Proxmox VE host for the x86 virtual estate.", [["CPU", "Ryzen 7 5800X"], ["Compute", "8C / 16T"], ["Memory", "128 GB"], ["PVE", "9.2"]], ["12 KVM virtual machines", "5 LXC system containers", "Local, USB, LVM-thin, and NFS storage"], ["Proxmox VE", "KVM", "LXC"]),
    ai: d("PHYSICAL / INFERENCE", "Inference server", "Dedicated 128 GB unified-memory system serving local model inference to ThreadBot and interactive clients.", [["Memory", "128 GB unified"], ["Runtime", "llama.cpp"], ["API", "OpenAI-compatible"]], ["ThreadBot worker deployments", "Open WebUI LXC client", "Private local inference"], ["llama.cpp", "Local AI"]),
    nas1: d("PHYSICAL / STORAGE", "NAS1", "Primary shared storage appliance. It backs Proxmox disks, Kubernetes NFS volumes, media, cloud files, and receives automated guest backups that are replicated to NAS2.", [["Protocol", "NFS"], ["Consumers", "PVE + Kubernetes"], ["Backup role", "Primary destination"], ["Replication", "NAS1 → NAS2"]], ["big-nas Proxmox datastore", "automated Proxmox backup destination", "nfs-client Kubernetes StorageClass", "Jellyfin and Nextcloud data", "replication source for NAS2"], ["NFS", "Shared storage", "Backups"]),
    nas2: d("PHYSICAL / STORAGE", "NAS2", "Secondary NAS appliance used as the replication target for automated backup copies stored on NAS1.", [["Role", "Backup replica"], ["Source", "NAS1"], ["Type", "NAS appliance"]], ["Replicated NAS1 backups", "Second copy on separate storage hardware"], ["NAS", "Replication", "Backups"]),

    p8s1: pi("p8s1", "worker", "8 GB", ["Temporal", "ThreadBot", "Argo CD API", "Pi Note"]),
    p8s2: pi("p8s2", "worker", "8 GB", ["Argo CD", "NFS provisioner", "cert-manager"]),
    p8s3: pi("p8s3", "control-plane", "8 GB", ["Kubernetes API", "etcd", "CoreDNS"]),
    p8s4: pi("p8s4", "worker", "8 GB", ["Temporal", "ThreadBot", "PgBouncer"]),
    p8s5: pi("p8s5", "worker", "8 GB", ["Temporal", "Zabbix", "GitLab ARM64 runner"]),

    local: store("PVE DIRECTORY", "local", "Host-local Proxmox directory storage.", "~94 GB", ["ISOs", "templates", "host-local data"]),
    locallvm: store("PVE LVM-THIN", "local-lvm", "Host-local thin-provisioned VM and container storage.", "~338 GB", ["Jellyfin OS", "UniFi", "Open WebUI", "Redis", "several LXC root filesystems"]),
    usbssd: store("PVE DIRECTORY", "USB-SSD", "USB-attached SSD datastore used by the previous GPU-backed Ollama VM.", "~468 GB", ["Ollama 200 GB virtual disk"]),
    bignas: store("PVE NFS", "big-nas", "NAS1-backed Proxmox datastore for most persistent VM disks.", "~10.7 TB", ["PostgreSQL", "GitLab", "Nextcloud", "Docker host", "three Kubernetes VMs"]),
    backups: store("PVE NFS", "backups", "NAS1-backed destination for automated Proxmox guest backups. Backup data is subsequently replicated to NAS2.", "~10.7 TB", ["Scheduled VM and LXC backups", "NAS1 primary copy", "NAS2 replicated copy"]),
    nfsclient: store("K8S STORAGECLASS", "nfs-client", "Dynamic NFS provisioner backed by NAS1.", "RWO + RWX", ["ThreadBot generated images", "Valheim data", "Dragonwilds data"]),
    openebs: store("K8S STORAGECLASS", "openebs-hostpath", "Node-local dynamic storage managed by OpenEBS.", "local PV", ["Checkmk site data"]),

    vm100: guest("KVM 100", "jellyfin", "running", "2 vCPU / 8 GB", "local-lvm 50 GB + PCIe GPU", ["Media streaming", "Hardware transcoding", "NAS1 media library"]),
    lxc101: guest("LXC 101", "unifi", "running", "2 vCPU / 1 GB", "local-lvm 8 GB", ["UniFi network controller", "Native systemd service"]),
    vm102: guest("KVM 102", "ollama", "stopped", "4 vCPU / 8 GB", "USB-SSD 200 GB + PCIe GPU", ["Previous Ollama model runtime"]),
    lxc103: guest("LXC 103", "chat", "running", "4 vCPU / 4 GB", "local-lvm 20 GB", ["Docker", "Open WebUI", "Client for local inference"]),
    vm104: guest("KVM 104", "windows", "running", "8 vCPU / 16 GB", "virtual disk", ["Windows development and utility environment"]),
    vm105: guest("KVM 105", "postgresql", "running", "4 vCPU / 8 GB", "big-nas 50 GB", ["Shared PostgreSQL backend", "Temporal persistence", "Application databases"]),
    vm106: guest("KVM 106", "openrsc", "stopped", "4 vCPU / 8 GB", "big-nas 100 GB", ["OpenRSC game server environment"]),
    lxc107: guest("LXC 107", "discordbot", "running", "2 vCPU / 2 GB", "local-lvm 16 GB", ["Discord automation runtime", "Docker host"]),
    vm108: kvmNode("k8s1", "control-plane", "local-lvm 70 GB"),
    lxc109: guest("LXC 109", "redis", "running", "3 vCPU / 4 GB", "local-lvm 16 GB", ["Redis Stack container", "Shared application cache and messaging"]),
    vm110: kvmNode("k8s2", "worker", "big-nas 70 GB"),
    vm112: guest("KVM 112", "docker", "running", "8 vCPU / 16 GB", "big-nas 50 GB", ["General-purpose Docker workloads"]),
    vm113: kvmNode("k8s3", "worker", "big-nas 70 GB"),
    vm114: guest("KVM 114", "nextcloud", "running", "4 vCPU / 8 GB", "big-nas 50 GB", ["Private cloud", "File sync and collaboration", "NAS1 cloud data"]),
    vm115: kvmNode("k8s4", "worker", "big-nas 70 GB"),
    vm116: guest("KVM 116", "gitlab", "running", "6 vCPU / 16 GB", "big-nas 100 GB", ["Git repositories", "Container registry", "CI/CD control plane"]),
    lxc117: guest("LXC 117", "gitlab-runner", "running", "2 vCPU / 2 GB", "local-lvm 8 GB", ["GitLab Runner service", "Docker executor"]),

    k8s1: clusterNode("k8s1", "control-plane", "amd64", "4 vCPU", "12 GB", ["API server", "etcd", "scheduler", "controller manager"]),
    k8s2: clusterNode("k8s2", "VM worker", "amd64", "4 vCPU", "12 GB", ["Argo controller", "MCP image cache"]),
    k8s3: clusterNode("k8s3", "VM worker", "amd64", "4 vCPU", "12 GB", ["Tempo", "Checkmk", "Valheim", "amd64 CI runner"]),
    k8s4: clusterNode("k8s4", "VM worker", "amd64", "4 vCPU", "12 GB", ["Dragonwilds", "MCP image cache"]),
    flannel: d("DAEMONSET", "Flannel", "Pod overlay network running on all nine Kubernetes nodes.", [["Pods", "9"], ["Scope", "all nodes"]], ["Pod-to-pod networking"], ["CNI", "DaemonSet"]),
    metallb: d("LOAD BALANCER", "MetalLB", "Layer-2 load balancer for services exposed from the bare-metal cluster.", [["Speakers", "9"], ["Controller", "1"]], ["Argo CD", "Temporal", "applications", "game servers"], ["L2", "LoadBalancer"]),
    nodeagents: d("DAEMONSETS", "Node agents", "Per-node operational services scheduled across the cluster.", [["Nodes", "9"], ["Scope", "mixed arch"]], ["kube-proxy", "Zabbix agent", "OpenEBS NDM", "MCP image pre-pull"], ["DaemonSet"]),

    gitlab: d("SOURCE / CI", "GitLab", "Self-hosted source control, container registry, and CI control plane running in a Proxmox VM.", [["Runtime", "KVM VM 116"], ["Disk", "NAS1-backed"], ["Runners", "LXC + Kubernetes"]], ["Argo CD repositories", "Container images", "amd64 and arm64 jobs"], ["GitLab", "CI/CD"]),
    argocd: workload("argocd", "GitOps controller", "mixed", "svc/argocd-server · LoadBalancer", "statefulset/argocd-application-controller; deploy/argocd-applicationset-controller; deploy/argocd-dex-server; deploy/argocd-notifications-controller; deploy/argocd-redis; deploy/argocd-repo-server; deploy/argocd-server", "18 Applications · app-of-apps"),
    temporal: workload("temporal", "Durable workflow platform", "Pi worker pool", "frontend, UI, and codec LoadBalancers", "deploy/temporal-frontend ×3; deploy/temporal-history ×3; deploy/temporal-matching ×3; deploy/temporal-worker ×3; deploy/temporal-web ×2; deploy/codec-server ×2; deploy/pgbouncer ×2; deploy/temporal-admintools; deploy/temporal-worker-controller-manager ×2; svc/temporal-frontend; svc/temporal-frontend-lb; svc/temporal-web-lb; svc/codec-server-lb", "PostgreSQL VM through PgBouncer"),
    threadbot: workload("threadbot", "Thread-based AI application", "Pi worker pool", "svc/threadbot-lb · LoadBalancer", "deploy/threadbot-backend ×2; deploy/threadbot-frontend ×2; deploy/threadbot-proxy; deploy/threadbot-agent-worker; deploy/threadbot-connector-worker; deploy/threadbot-notification-worker; deploy/threadbot-worker ×3; svc/threadbot-backend; svc/threadbot-frontend; svc/threadbot-lb", "PostgreSQL · Redis Stack · NFS RWX · local inference"),
    tempo: workload("tempo", "Temporal client and web application", "amd64 / k8s3", "svc/tempo-web · LoadBalancer", "deploy/tempo-web ×2; Envoy sidecar ×2; svc/tempo-web", "Temporal frontend · codec service"),
    pinote: workload("pi-note", "Pi Note application", "arm64 / p8s1", "svc/pi-note-lb · LoadBalancer", "deploy/pi-note-server; svc/pi-note-server; svc/pi-note-lb", "Argo CD-managed application"),
    games: workload("game servers", "Valheim and Dragonwilds", "amd64 / k8s3 + k8s4", "UDP LoadBalancers", "deploy/valheim-server; svc/valheim-server; deploy/dragonwilds-server; svc/dragonwilds-server", "NFS RWO volumes · 40 GB requested"),
    monitoring: workload("monitoring", "Checkmk and Zabbix", "mixed / all nodes", "web LoadBalancers + agent ClusterIP", "deploy/checkmk; deploy/zabbix-server; deploy/zabbix-web; deploy/zabbix-webservice; daemonset/zabbix-agent; svc/checkmk; svc/zabbix-web", "OpenEBS 20 GB · node agents"),
    runners: workload("CI runners", "GitLab runner operator", "amd64 + arm64", "internal", "deploy/gitlab-runner-controller-manager; deploy/gitlab-runner-runner; deploy/gitlab-runner-arm64-runner", "Ephemeral cross-architecture build jobs"),
    clusterplatform: workload("cluster services", "Kubernetes platform services", "all nodes", "internal + LoadBalancer", "deploy/coredns ×2; deploy/metrics-server; deploy/cert-manager; deploy/cert-manager-cainjector; deploy/cert-manager-webhook; deploy/headlamp; daemonset/kube-proxy; daemonset/kube-flannel; deploy/metallb-controller; daemonset/metallb-speaker; deploy/nfs-subdir-external-provisioner; deploy/openebs-localpv-provisioner; daemonset/openebs-ndm", "Argo CD · Helm · cluster bootstrap"),
    mcp: workload("mcp-sessions", "Ephemeral MCP tool sessions", "8 workers", "internal", "daemonset/mcp-image-prepull; on-demand mcp-* pods", "Runtime tool discovery for agent workloads"),

    nextcloudData: consumer("Nextcloud data", "NAS1", ["Cloud files", "VM disk"]),
    jellyfinData: consumer("Jellyfin media", "NAS1", ["Media library", "GPU transcoding"]),
    vmDisks: consumer("VM disks", "big-nas", ["PostgreSQL", "GitLab", "Nextcloud", "Docker", "Kubernetes VMs"]),
    k8sPvs: consumer("Kubernetes PVs", "nfs-client + OpenEBS", ["ThreadBot", "game servers", "Checkmk"]),
    pveBackups: consumer("Automated backups", "NAS1 → NAS2", ["Scheduled Proxmox VM backups", "Scheduled Proxmox LXC backups", "Primary copy on NAS1", "Replicated copy on NAS2"])
};

const views = {
    physical: {
        initial: "proxmox1",
        zones: [["COMPUTE HARDWARE", 5, 58], ["STORAGE APPLIANCES", 68, 27]],
        nodes: [
            n("proxmox1", 12, 30, "PVE", "proxmox1", "8C/16T · 128 GB", "blue"),
            n("p8s1", 31, 20, "ARM", "p8s1", "worker · 8 GB", "green"), n("p8s2", 49, 20, "ARM", "p8s2", "worker · 8 GB", "green"),
            n("p8s3", 67, 20, "ARM", "p8s3", "control · 8 GB", "amber"), n("p8s4", 40, 46, "ARM", "p8s4", "worker · 8 GB", "green"),
            n("p8s5", 59, 46, "ARM", "p8s5", "worker · 8 GB", "green"), n("ai", 88, 31, "AI", "inference", "128 GB unified", "pink"),
            n("nas1", 34, 82, "NFS", "NAS1", "primary + backups", "purple"), n("nas2", 68, 82, "NAS", "NAS2", "backup replica", "purple")
        ],
        edges: [["proxmox1", "nas1"], ["p8s1", "nas1"], ["p8s2", "nas1"], ["p8s3", "nas1"], ["p8s4", "nas1"], ["p8s5", "nas1"], ["nas1", "nas2"]]
    },
    proxmox: {
        initial: "proxmox1",
        zones: [["HYPERVISOR", 2, 18], ["PVE DATASTORES", 24, 19], ["KVM + LXC GUESTS", 49, 48]],
        nodes: [
            n("proxmox1", 50, 11, "PVE", "proxmox1", "17 guests · 5 stores", "blue"),
            n("local", 10, 33, "DIR", "local", "host directory", "purple"), n("locallvm", 30, 33, "LVM", "local-lvm", "LVM-thin", "purple"),
            n("usbssd", 50, 33, "USB", "USB-SSD", "directory", "purple"), n("bignas", 70, 33, "NFS", "big-nas", "NAS1 NFS", "purple"),
            n("backups", 90, 33, "NFS", "backups", "NAS1 NFS", "purple"),
            ...guestRow([["vm100","jellyfin"],["lxc101","unifi"],["vm102","ollama"],["lxc103","chat"],["vm104","windows"],["vm105","postgresql"]], 59),
            ...guestRow([["vm106","openrsc"],["lxc107","discordbot"],["vm108","k8s1"],["lxc109","redis"],["vm110","k8s2"],["vm112","docker"]], 76),
            ...guestRow([["vm113","k8s3"],["vm114","nextcloud"],["vm115","k8s4"],["vm116","gitlab"],["lxc117","gitlab-runner"]], 93)
        ],
        edges: [["locallvm","vm100"],["locallvm","lxc101"],["usbssd","vm102"],["locallvm","lxc103"],["bignas","vm105"],["bignas","vm106"],["locallvm","vm108"],["locallvm","lxc109"],["bignas","vm110"],["bignas","vm112"],["bignas","vm113"],["bignas","vm114"],["bignas","vm115"],["bignas","vm116"],["locallvm","lxc117"]]
    },
    kubernetes: {
        initial: "k8s1",
        zones: [["CONTROL PLANES", 4, 24], ["AMD64 VM WORKERS", 35, 23], ["ARM64 PHYSICAL WORKERS", 65, 28]],
        nodes: [
            n("k8s1", 32, 17, "K8S", "k8s1", "control · amd64", "amber"), n("p8s3", 68, 17, "K8S", "p8s3", "control · arm64", "amber"),
            n("k8s2", 22, 48, "VM", "k8s2", "worker · 4C/12G", "blue"), n("k8s3", 42, 48, "VM", "k8s3", "worker · 4C/12G", "blue"), n("k8s4", 62, 48, "VM", "k8s4", "worker · 4C/12G", "blue"),
            n("p8s1", 12, 78, "ARM", "p8s1", "worker · 4C/8G", "green"), n("p8s2", 29, 78, "ARM", "p8s2", "worker · 4C/8G", "green"),
            n("p8s4", 46, 78, "ARM", "p8s4", "worker · 4C/8G", "green"), n("p8s5", 63, 78, "ARM", "p8s5", "worker · 4C/8G", "green"),
            n("flannel", 82, 47, "CNI", "Flannel", "9 daemon pods", "gray"), n("metallb", 82, 68, "LB", "MetalLB", "9 speakers", "gray"), n("nodeagents", 82, 88, "DS", "node agents", "all nodes", "gray")
        ],
        edges: [["k8s1","k8s2"],["k8s1","k8s3"],["k8s1","k8s4"],["p8s3","p8s1"],["p8s3","p8s2"],["p8s3","p8s4"],["p8s3","p8s5"],["flannel","nodeagents"],["metallb","nodeagents"]]
    },
    workloads: {
        initial: "threadbot",
        zones: [["SOURCE + EXTERNAL SYSTEMS", 3, 21], ["APPLICATION NAMESPACES", 31, 43], ["CLUSTER PLATFORM", 81, 15]],
        nodes: [
            n("gitlab", 24, 13, "GIT", "GitLab", "SCM · registry · CI", "amber"), n("argocd", 55, 13, "SYNC", "Argo CD", "18 applications", "amber"),
            n("ai", 84, 13, "AI", "AI inference", "local model API", "pink"),
            n("temporal", 12, 41, "WF", "Temporal", "18 service pods", "green"), n("threadbot", 32, 41, "AI", "ThreadBot", "11 application pods", "green"),
            n("tempo", 52, 41, "APP", "Tempo", "2 replicas + sidecars", "green"), n("pinote", 72, 41, "APP", "Pi Note", "ARM64 application", "green"),
            n("games", 17, 68, "UDP", "game servers", "Valheim + Dragonwilds", "blue"), n("monitoring", 41, 68, "OBS", "monitoring", "Checkmk + Zabbix", "blue"),
            n("runners", 65, 68, "CI", "CI runners", "amd64 + arm64", "blue"), n("mcp", 86, 68, "MCP", "MCP sessions", "ephemeral tools", "blue"),
            n("clusterplatform", 22, 89, "SYS", "cluster services", "network · certs · UI", "gray"), n("nfsclient", 51, 89, "NFS", "NFS provisioner", "shared PVs", "purple"), n("openebs", 79, 89, "PV", "OpenEBS", "local PVs", "purple")
        ],
        edges: [["gitlab","argocd"],["argocd","temporal"],["argocd","threadbot"],["argocd","tempo"],["argocd","pinote"],["argocd","games"],["argocd","monitoring"],["argocd","runners"],["temporal","threadbot"],["temporal","tempo"],["threadbot","ai"],["nfsclient","threadbot"],["nfsclient","games"],["openebs","monitoring"],["mcp","threadbot"]]
    },
    storage: {
        initial: "nas1",
        zones: [["PHYSICAL TARGETS", 3, 20], ["PROXMOX DATASTORES", 29, 20], ["KUBERNETES STORAGE", 56, 17], ["STATEFUL CONSUMERS", 79, 17]],
        nodes: [
            n("nas1", 34, 13, "NAS", "NAS1", "primary + backups", "purple"), n("nas2", 67, 13, "NAS", "NAS2", "backup replica", "purple"),
            n("local", 8, 39, "DIR", "local", "host local", "gray"), n("locallvm", 27, 39, "LVM", "local-lvm", "LVM-thin", "gray"), n("usbssd", 46, 39, "USB", "USB-SSD", "directory", "gray"),
            n("bignas", 66, 39, "NFS", "big-nas", "NAS1", "purple"), n("backups", 86, 39, "NFS", "backups", "automated · NAS1", "purple"),
            n("nfsclient", 36, 65, "SC", "nfs-client", "RWO + RWX", "green"), n("openebs", 65, 65, "SC", "openebs-hostpath", "node local", "green"),
            n("vmDisks", 10, 88, "VM", "VM disks", "5+ NAS-backed", "blue"), n("nextcloudData", 29, 88, "NC", "Nextcloud", "cloud data", "blue"),
            n("jellyfinData", 48, 88, "JF", "Jellyfin", "media data", "blue"), n("k8sPvs", 68, 88, "PVC", "Kubernetes PVs", "5 bound claims", "blue"), n("pveBackups", 88, 88, "BK", "automated backups", "NAS1 → NAS2", "blue")
        ],
        edges: [["nas1","nas2"],["nas1","bignas"],["nas1","backups"],["nas1","nfsclient"],["bignas","vmDisks"],["nas1","nextcloudData"],["nas1","jellyfinData"],["nfsclient","k8sPvs"],["openebs","k8sPvs"],["backups","pveBackups"],["pveBackups","nas2"]]
    }
};

const map = document.querySelector("#topology-map");
const svg = document.querySelector("#connections");
const nodeLayer = document.querySelector("#map-nodes");
const zoneLayer = document.querySelector("#map-zones");
let currentView = "physical";
let selectedId = views.physical.initial;

function showView(name, preferredId) {
    currentView = name;
    const view = views[name];
    selectedId = preferredId && view.nodes.some(node => node.id === preferredId) ? preferredId : view.initial;
    document.querySelectorAll("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === name));
    map.classList.toggle("dense", view.nodes.length > 12);
    zoneLayer.replaceChildren(...view.zones.map(([label, top, height]) => {
        const zone = document.createElement("div");
        zone.className = "zone";
        zone.style.top = `${top}%`;
        zone.style.height = `${height}%`;
        const text = document.createElement("span");
        text.textContent = label;
        zone.appendChild(text);
        return zone;
    }));
    nodeLayer.replaceChildren(...view.nodes.map(item => {
        const button = document.createElement("button");
        button.className = `node tone-${item.tone}`;
        button.dataset.id = item.id;
        button.style.setProperty("--x", item.x);
        button.style.setProperty("--y", item.y);
        button.innerHTML = `<span class="node-icon">${item.icon}</span><span class="node-label">${item.label}</span><span class="node-meta">${item.meta}</span>`;
        button.addEventListener("click", () => showDetails(item.id));
        return button;
    }));
    showDetails(selectedId);
    requestAnimationFrame(drawConnections);
}

function drawConnections() {
    const view = views[currentView];
    const mapRect = map.getBoundingClientRect();
    svg.replaceChildren();
    view.edges.forEach(([from, to]) => {
        const fromEl = nodeLayer.querySelector(`[data-id="${from}"]`);
        const toEl = nodeLayer.querySelector(`[data-id="${to}"]`);
        if (!fromEl || !toEl) return;
        const a = fromEl.getBoundingClientRect();
        const b = toEl.getBoundingClientRect();
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", a.left + a.width / 2 - mapRect.left);
        line.setAttribute("y1", a.top + a.height / 2 - mapRect.top);
        line.setAttribute("x2", b.left + b.width / 2 - mapRect.left);
        line.setAttribute("y2", b.top + b.height / 2 - mapRect.top);
        if (from === selectedId || to === selectedId) line.classList.add("active");
        svg.appendChild(line);
    });
}

function showDetails(id) {
    selectedId = id;
    const item = details[id];
    nodeLayer.querySelectorAll(".node").forEach(node => node.classList.toggle("selected", node.dataset.id === id));
    document.querySelector("#detail-kind").textContent = item.kind;
    document.querySelector("#detail-title").textContent = item.title;
    document.querySelector("#detail-description").textContent = item.description;
    document.querySelector("#detail-status").textContent = item.status === "stopped" ? "○ STOPPED" : "● INVENTORIED";
    document.querySelector("#detail-status").classList.toggle("stopped", item.status === "stopped");
    const specs = document.querySelector("#detail-specs");
    specs.replaceChildren(...item.specs.map(([key, value]) => el("div", [el("dt", key), el("dd", value)])));
    document.querySelector("#detail-responsibilities").replaceChildren(...item.connections.map(text => el("li", text)));
    document.querySelector("#detail-tags").replaceChildren(...item.tags.map(text => el("span", text)));
    drawConnections();
}

document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => showView(button.dataset.view)));
window.addEventListener("resize", drawConnections);
window.addEventListener("load", () => {
    const requestedView = new URLSearchParams(window.location.search).get("view");
    showView(views[requestedView] ? requestedView : "physical");
});

function d(kind, title, description, specs, connections, tags, status = "running") { return { kind, title, description, specs, connections, tags, status }; }
function n(id, x, y, icon, label, meta, tone) { return { id, x, y, icon, label, meta, tone }; }
function el(tag, content) { const node = document.createElement(tag); Array.isArray(content) ? node.append(...content) : node.textContent = content; return node; }
function pi(name, role, memory, hosted) { return d("PHYSICAL / ARM64", name, `Raspberry Pi Kubernetes ${role} node running Debian.`, [["CPU", "4 ARM cores"], ["Memory", memory], ["Role", role], ["Runtime", "containerd"]], hosted, ["Raspberry Pi", "ARM64", "Debian", "Kubernetes"]); }
function store(kind, title, description, capacity, connections) { return d(kind, title, description, [["Capacity", capacity], ["Status", "active"]], connections, ["Storage"]); }
function guest(kind, title, status, compute, storage, connections) { return d(kind, title, `${title} ${kind.startsWith("KVM") ? "virtual machine" : "system container"} on proxmox1.`, [["State", status], ["Compute", compute], ["Storage", storage]], connections, [kind.split(" ")[0], "Proxmox"], status); }
function kvmNode(name, role, storage) { const id = {k8s1:"108",k8s2:"110",k8s3:"113",k8s4:"115"}[name]; return guest(`KVM ${id}`, name, "running", "4 vCPU / 12 GB", storage, [`Kubernetes ${role}`, "Ubuntu 24.04", "containerd"]); }
function clusterNode(name, role, arch, cpu, memory, hosted) { return d("KUBERNETES NODE", name, `${arch} Kubernetes ${role} node.`, [["Status", "Ready"], ["Role", role], ["Architecture", arch], ["CPU", cpu], ["Memory", memory]], hosted, ["Kubernetes 1.32", "containerd"]); }
function workload(title, description, placement, exposure, components, dependencies) { return d("KUBERNETES WORKLOAD", title, description, [["Placement", placement], ["Exposure", exposure], ["Data / dependencies", dependencies], ["Delivery", "Argo CD"]], components.split("; "), ["Kubernetes", "Argo CD"]); }
function consumer(title, storage, contents) { return d("STATEFUL CONSUMER", title, `${title} data path.`, [["Backing storage", storage]], contents, ["Persistent data"]); }
function guestRow(items, y) { const step = 15.6; const start = items.length === 5 ? 18.8 : 11; return items.map(([id,label], i) => n(id, start + i * step, y, id.startsWith("lxc") ? "LXC" : "VM", label, details[id].specs[0][1], details[id].status === "stopped" ? "gray" : "blue")); }
