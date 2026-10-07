#!/usr/bin/env node

// src/mcp.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z as z2 } from "zod";

// src/queue.ts
import { randomBytes } from "crypto";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";

// src/types.ts
import { z } from "zod";
var VisdiffSourceSchema = z.object({
  file: z.string().min(1),
  line: z.number().optional(),
  column: z.number().optional(),
  component: z.string().optional()
});
var VisdiffEditSchema = z.object({
  property: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
  kind: z.enum(["move", "resize", "style"]).optional(),
  note: z.preprocess(
    (value) => typeof value === "string" ? value.trim() : value,
    z.string().max(400).optional().transform((value) => value && value.length > 0 ? value : void 0)
  )
}).superRefine((edit, ctx) => {
  if (edit.from === void 0 && edit.to === void 0) {
    ctx.addIssue({ code: "custom", message: "an edit requires a from or to value" });
  }
}).transform((edit) => {
  const from = edit.from ?? "";
  const to = edit.to ?? from;
  const kind = edit.kind ?? "resize";
  const note = edit.note;
  return { property: edit.property, from, to, kind, ...note ? { note } : {} };
});
var VisdiffTaskElementSchema = z.object({
  tag: z.string().min(1),
  selector: z.string().min(1),
  text: z.string().default(""),
  source: z.union([VisdiffSourceSchema, z.null()]).default(null)
});
var VisdiffSelectionGroupSchema = z.object({
  id: z.string().min(1),
  selectedCount: z.number().int().min(2),
  role: z.enum(["member", "layout-container"])
});
var VisdiffTaskChangeSchema = z.object({
  element: VisdiffTaskElementSchema,
  edits: z.array(VisdiffEditSchema).min(1),
  selectionGroups: z.array(VisdiffSelectionGroupSchema).optional()
});
var VisdiffTaskPayloadSchema = z.object({
  url: z.string().min(1),
  viewport: z.object({
    width: z.number().nonnegative(),
    height: z.number().nonnegative()
  }),
  changes: z.array(VisdiffTaskChangeSchema).min(1),
  note: z.preprocess(
    (value) => typeof value === "string" ? value.trim() : value,
    z.string().max(1e3).optional().transform((value) => value && value.length > 0 ? value : void 0)
  )
});
var VisdiffTaskSchema = VisdiffTaskPayloadSchema.extend({
  id: z.string().min(1),
  receivedAt: z.iso.datetime()
});
var VisdiffTaskQueueSchema = z.array(VisdiffTaskSchema);

// src/queue.ts
var QUEUE_DIR = ".visdiff";
var QUEUE_FILE = "pending.json";
var mutationTail = Promise.resolve();
function queueFile(root = process.cwd()) {
  return path.join(root, QUEUE_DIR, QUEUE_FILE);
}
function newTaskId() {
  return `vdt_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}
async function readPending(root) {
  let raw;
  try {
    raw = await readFile(queueFile(root), "utf8");
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${queueFile(root)}`, { cause: error });
  }
  const result = VisdiffTaskQueueSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid task data in ${queueFile(root)}: ${result.error.issues[0]?.message ?? "schema mismatch"}`);
  }
  return result.data;
}
async function writePending(root, tasks) {
  const file = queueFile(root);
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  await writeFile(tmp, `${JSON.stringify(tasks, null, 2)}
`, "utf8");
  await rename(tmp, file);
}
function enqueueMutation(operation) {
  const result = mutationTail.then(operation);
  mutationTail = result.then(() => void 0, () => void 0);
  return result;
}
async function appendTask(root, task) {
  await enqueueMutation(async () => {
    const tasks = await readPending(root);
    tasks.push(task);
    await writePending(root, tasks);
  });
}
function clearPending(root) {
  return enqueueMutation(async () => {
    const tasks = await readPending(root);
    await writePending(root, []);
    return tasks.length;
  });
}
function removePending(root, ids) {
  return enqueueMutation(async () => {
    const wanted = new Set(ids);
    const tasks = await readPending(root);
    const remaining = tasks.filter((task) => !wanted.has(task.id));
    await writePending(root, remaining);
    return tasks.length - remaining.length;
  });
}

// src/agent-guidance.ts
var AGENT_WORKFLOW = `Visdiff agent workflow

First-time project setup (do this once per project):
1. Inspect the project root, package scripts, framework, bundler, and existing configuration before changing anything.
2. If Visdiff is already integrated, do not add a duplicate plugin. Otherwise, for a Vite project using React, Vue 3, or Svelte, add the Visdiff Vite plugin to the existing Vite config before the framework plugin. Add the package dependency only if the project does not already have it.
3. Do not edit components or templates to add markers. Visdiff adds development-only source anchors automatically for supported Vite frameworks. Keep the integration out of production builds.
4. If the project uses another bundler or framework, do not claim equivalent source-anchor support. Use only an existing documented adapter, explain any manual client-script step, and report that source locations may be unavailable. Ask before introducing a custom compiler integration.
5. Tell the user what one-time config/dependency change was made and how to start or restart the development server. The user opens the running app, makes a visual edit, and applies it; do not invent a task if the queue is empty.

For each visual task:
1. Read the complete task, including task.note and per-edit notes. Treat notes as user intent and CSS from/to values as observed browser results, not implementation instructions.
2. Group related changes by selectionGroups.id. A "member" is a selected element; "layout-container" is its shared parent. selectedCount is the number of selected elements, not the number of task changes; a layout-container entry represents one change to their shared parent. Apply related changes together when appropriate.
3. Inspect element.source and nearby component/styles. Use selector, text, URL, and viewport as runtime context; do not paste selectors or generated CSS blindly into source.
4. Make the smallest maintainable source change that achieves the requested result. Preserve responsive behavior and unrelated styling. If the note, captured viewport, and CSS delta leave responsive scope unclear, ask before choosing between a breakpoint-specific and global change.
5. Run the relevant checks and verify the result in the application at the task viewport when possible. If a task is ambiguous or cannot be verified, leave it pending and report the limitation.
6. Remove only task IDs whose changes were implemented and verified. With the CLI, use "visdiff clear <task-id> [task-id ...]"; never use bare "visdiff clear" for partial completion. With MCP, pass only those IDs to visdiff_clear_tasks.`;

// src/mcp.ts
function textContent(body) {
  return { content: [{ type: "text", text: JSON.stringify(body, null, 2) }] };
}
async function runMcpServer(root) {
  const server = new McpServer({ name: "visdiff", version: "0.1.0" });
  server.registerTool(
    "visdiff_pending_tasks",
    {
      title: "List pending visual tasks",
      description: `Read pending visual tasks from the project queue.

${AGENT_WORKFLOW}`,
      inputSchema: {}
    },
    async () => {
      const tasks = await readPending(root);
      if (tasks.length === 0) return textContent({ message: "No pending visual tasks." });
      return textContent({ queueFile: queueFile(root), tasks });
    }
  );
  server.registerTool(
    "visdiff_clear_tasks",
    {
      title: "Clear applied visual tasks",
      description: "Remove only listed task IDs whose changes have been implemented and verified. Do not clear unapplied tasks; tasks not listed remain pending.",
      inputSchema: { ids: z2.array(z2.string().min(1)).min(1) }
    },
    async ({ ids }) => {
      const cleared = await removePending(root, ids);
      return textContent({ cleared });
    }
  );
  await server.connect(new StdioServerTransport());
}

// src/server-core.ts
import { createServer } from "http";
import { readFile as readFile2 } from "fs/promises";
import path2 from "path";
import { fileURLToPath } from "url";
var VISDIFF_BASE = "/__visdiff";
var CLIENT_PATH = "client.js";
var MAX_BODY = 512 * 1024;
var LOCAL_PAGE_ORIGINS = {
  localhost: true,
  "127.0.0.1": true,
  "[::1]": true
};
var LOCAL_PAGE_PROTOCOLS = {
  "http:": true,
  "https:": true
};
function parsePayload(raw) {
  const parsed = VisdiffTaskPayloadSchema.safeParse(raw);
  if (!parsed.success) return null;
  const payload = parsed.data;
  return {
    ...payload,
    viewport: {
      width: Math.round(payload.viewport.width),
      height: Math.round(payload.viewport.height)
    }
  };
}
function summarizeTask(task, root) {
  const tty = process.stdout.isTTY;
  const c = (s, code) => tty ? `${code}${s}\x1B[0m` : s;
  const bold = "\x1B[1m";
  const dim = "\x1B[2m";
  const cyan = "\x1B[36m";
  const lines = [c(`\u25B2 visdiff \xB7 task ${task.id} \xB7 ${task.changes.length} element(s)`, cyan)];
  if (task.note !== void 0 && task.note.length > 0) {
    lines.push(`  note: ${task.note}`);
  }
  for (const change of task.changes) {
    const src = change.element.source;
    const loc = src ? `${src.file}${src.line != null ? `:${src.line}` : ""}` : change.element.selector;
    const column = src?.line != null && src.column != null ? c(`:${src.column}`, dim) : "";
    const component = src?.component ? c(`  (${src.component})`, dim) : "";
    lines.push(`  ${c(loc, bold)}${column}${component}`);
    for (const edit of change.edits) {
      const to = edit.to.length <= 48 ? edit.to : `${edit.to.slice(0, 47)}\u2026`;
      lines.push(`    ${edit.property}: ${c(edit.from, dim)} \u2192 ${to}`);
    }
  }
  lines.push(c(`  queue \u2192 ${queueFile(root)}`, dim));
  return lines.join("\n");
}
var distDir = path2.dirname(fileURLToPath(import.meta.url));
var clientWarned = false;
async function loadClient() {
  try {
    return await readFile2(path2.join(distDir, CLIENT_PATH), "utf8");
  } catch {
    if (!clientWarned) {
      clientWarned = true;
      console.error('[visdiff] dist/client.js missing \u2014 rebuild the package ("npm run build" in packages/visdiff)');
    }
    return `console.error('[visdiff] overlay script missing: rebuild the visdiff package')`;
  }
}
function createVisdiffHandler(options) {
  return async (req, res) => {
    const u = new URL(req.url ?? "/", "http://localhost");
    let p = u.pathname;
    if (p.startsWith(VISDIFF_BASE)) p = p.slice(VISDIFF_BASE.length) || "/";
    if (p === "/") return false;
    if (req.method === "GET" && p === `/client.js`) {
      const body = await loadClient();
      res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
      res.end(body);
      return true;
    }
    if (options.cors) {
      const origin = req.headers.origin;
      if (origin !== void 0) {
        let parsedOrigin;
        try {
          parsedOrigin = new URL(origin);
        } catch {
          res.writeHead(403);
          res.end();
          return true;
        }
        if (LOCAL_PAGE_ORIGINS[parsedOrigin.hostname] !== true || LOCAL_PAGE_PROTOCOLS[parsedOrigin.protocol] !== true) {
          res.writeHead(403);
          res.end();
          return true;
        }
        res.setHeader("access-control-allow-origin", origin);
        res.setHeader("vary", "Origin");
      }
      res.setHeader("access-control-allow-methods", "POST, GET, OPTIONS");
      res.setHeader("access-control-allow-headers", "content-type");
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return true;
    }
    if (req.method === "POST" && p === "/save") {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY) {
          res.writeHead(413, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "payload too large" }));
          return true;
        }
        chunks.push(chunk);
      }
      let rawPayload;
      try {
        rawPayload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "invalid task payload" }));
        return true;
      }
      const payload = parsePayload(rawPayload);
      if (payload === null) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "invalid task payload" }));
        return true;
      }
      const task = { ...payload, id: newTaskId(), receivedAt: (/* @__PURE__ */ new Date()).toISOString() };
      await appendTask(options.root, task);
      console.log(summarizeTask(task, options.root));
      res.writeHead(201, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: task.id, file: queueFile(options.root) }));
      return true;
    }
    if (req.method === "GET" && p === "/pending") {
      const tasks = await readPending(options.root);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(tasks, null, 2));
      return true;
    }
    if (req.method === "POST" && p === "/clear") {
      const cleared = await clearPending(options.root);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ cleared }));
      return true;
    }
    return false;
  };
}
async function startStandaloneServer(options) {
  const handler = createVisdiffHandler({ root: options.root, cors: true });
  const firstPort = options.port;
  const maxPort = firstPort + 20;
  for (let port = firstPort; port <= maxPort; port++) {
    const server = createServer((req, res) => {
      handler(req, res).then((handled) => {
        if (!handled) {
          res.writeHead(404);
          res.end();
        }
      }).catch((err) => {
        console.error("[visdiff] request failed", err);
        res.writeHead(500);
        res.end();
      });
    });
    try {
      await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
        server.listen(port, "127.0.0.1");
      });
      const url = `http://127.0.0.1:${port}${VISDIFF_BASE}`;
      console.log(`[visdiff] endpoint ${url}`);
      console.log(`[visdiff] inject <script defer src="${url}/client.js"></script> into your dev page, then make edits and press "\u2714 Generate task"`);
      return {
        port,
        url,
        close: () => server.close()
      };
    } catch (err) {
      await new Promise((resolve) => server.close(() => resolve()));
      const code = typeof err === "object" && err !== null && "code" in err && typeof err.code === "string" ? err.code : "";
      if (code !== "EADDRINUSE" || port === maxPort) throw err;
    }
  }
  throw new Error(`[visdiff] no free port in ${firstPort}..${maxPort}`);
}

// src/cli.ts
var USAGE = `visdiff \u2014 browser visual edits \u2192 JSON tasks for coding agents

Usage: visdiff <command>

  mcp            Run the MCP stdio server (tools: visdiff_pending_tasks, visdiff_clear_tasks)
  tasks          Print pending visual tasks (.visdiff/pending.json)
  instructions   Print the recommended coding-agent workflow
  clear [ids...] Remove only the listed task IDs; with no IDs, clear the entire queue
  serve [opts]   Start a standalone endpoint server (default port 9090) for non-plugin dev setups
  help           Show this help

From this repository checkout, use:
  npm exec --workspace examples/vite-react -- visdiff tasks
  npm exec --workspace examples/vite-react -- visdiff instructions
  npm exec --workspace examples/vite-react -- visdiff mcp
`;
function parsePortFlag(argv) {
  let port = 9090;
  for (const arg of argv) {
    if (arg.startsWith("--port=")) {
      const parsed = Number.parseInt(arg.slice("--port=".length), 10);
      if (Number.isFinite(parsed) && parsed > 0) port = parsed;
    }
  }
  return port;
}
async function printTasks() {
  const tasks = await readPending(process.cwd());
  if (tasks.length === 0) {
    console.log("No pending visual tasks.");
    return;
  }
  console.log(JSON.stringify(tasks, null, 2));
}
async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (cmd === void 0 || cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(USAGE);
    return;
  }
  switch (cmd) {
    case "mcp":
      await runMcpServer(process.cwd());
      return;
    case "tasks":
      await printTasks();
      return;
    case "instructions":
      console.log(AGENT_WORKFLOW);
      return;
    case "clear": {
      const ids = argv.slice(1).map((id) => id.trim());
      if (ids.some((id) => id.length === 0)) {
        throw new Error("Task IDs must not be empty.");
      }
      const cleared = ids.length > 0 ? await removePending(process.cwd(), ids) : await clearPending(process.cwd());
      console.log(`[visdiff] cleared ${cleared} pending task(s)`);
      return;
    }
    case "serve": {
      await startStandaloneServer({ root: process.cwd(), port: parsePortFlag(argv.slice(1)) });
      console.log("[visdiff] Ctrl-C to stop");
      return;
    }
    default:
      console.error(`[visdiff] unknown command: ${cmd}`);
      console.log(USAGE);
      process.exitCode = 1;
  }
}
main().catch((err) => {
  console.error(String(err));
  process.exitCode = 1;
});
