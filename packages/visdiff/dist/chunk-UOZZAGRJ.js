// src/server-core.ts
import { createServer } from "http";
import { readFile as readFile2 } from "fs/promises";
import path2 from "path";
import { fileURLToPath } from "url";

// src/types.ts
import { z } from "zod";
var VisdiffSourceSchema = z.object({
  file: z.string().min(1),
  line: z.number().finite().optional(),
  column: z.number().finite().optional(),
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
var VisdiffTaskChangeSchema = z.object({
  element: VisdiffTaskElementSchema,
  edits: z.array(VisdiffEditSchema).min(1)
});
var VisdiffTaskPayloadSchema = z.object({
  url: z.string().min(1),
  viewport: z.object({
    width: z.number().finite().nonnegative(),
    height: z.number().finite().nonnegative()
  }),
  changes: z.array(VisdiffTaskChangeSchema).min(1),
  note: z.preprocess(
    (value) => typeof value === "string" ? value.trim() : value,
    z.string().max(1e3).optional().transform((value) => value && value.length > 0 ? value : void 0)
  )
});
var VisdiffTaskSchema = VisdiffTaskPayloadSchema.extend({
  id: z.string().min(1),
  receivedAt: z.string().datetime()
});
var VisdiffTaskQueueSchema = z.array(VisdiffTaskSchema);

// src/queue.ts
import { randomBytes } from "crypto";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
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

// src/server-core.ts
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
var clientCache = null;
var clientWarned = false;
async function loadClient() {
  if (clientCache !== null) return clientCache;
  try {
    clientCache = await readFile2(path2.join(distDir, CLIENT_PATH), "utf8");
    return clientCache;
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
      let payload = null;
      try {
        payload = parsePayload(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        payload = null;
      }
      if (!payload) {
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

// src/source-inject.ts
import { existsSync } from "fs";
import path3 from "path";
import { transformSync, types as t } from "@babel/core";
function injectReactSource(code, id, projectRoot) {
  if (!code.includes("<")) return null;
  const idPath = id.split("?")[0] ?? id;
  if (idPath.includes("/node_modules/")) return null;
  const extension = path3.extname(idPath);
  if (extension !== ".js" && extension !== ".jsx" && extension !== ".tsx") return null;
  const root = path3.resolve(projectRoot);
  let absoluteFile;
  if (path3.isAbsolute(idPath)) {
    const candidate = path3.resolve(idPath);
    const candidateRelative = path3.relative(root, candidate);
    const outsideRoot = candidateRelative === ".." || candidateRelative.startsWith(`..${path3.sep}`) || path3.isAbsolute(candidateRelative);
    if (!outsideRoot) {
      absoluteFile = candidate;
    } else {
      const rootRelative = path3.resolve(root, idPath.replace(/^[/\\]+/, ""));
      if (!existsSync(rootRelative)) return null;
      absoluteFile = rootRelative;
    }
  } else {
    absoluteFile = path3.resolve(root, idPath);
  }
  const relativeFile = path3.relative(root, absoluteFile);
  if (relativeFile === ".." || relativeFile.startsWith(`..${path3.sep}`) || path3.isAbsolute(relativeFile)) return null;
  const file = relativeFile.split(path3.sep).join("/");
  let changed = false;
  const sourcePlugin = {
    visitor: {
      JSXOpeningElement(nodePath) {
        const hasSource = nodePath.node.attributes.some((attribute) => t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: "data-visdiff-src" }));
        if (hasSource) return;
        const start = nodePath.node.loc?.start;
        if (start === void 0) return;
        const source = JSON.stringify({ file, line: start.line, column: start.column + 1 });
        nodePath.node.attributes.push(
          t.jsxAttribute(
            t.jsxIdentifier("data-visdiff-src"),
            t.jsxExpressionContainer(t.stringLiteral(source))
          )
        );
        changed = true;
      }
    }
  };
  try {
    const result = transformSync(code, {
      filename: idPath,
      root,
      configFile: false,
      babelrc: false,
      ast: false,
      sourceMaps: true,
      retainLines: true,
      parserOpts: {
        sourceType: "unambiguous",
        plugins: extension === ".tsx" ? ["typescript", "jsx"] : ["jsx"]
      },
      plugins: [sourcePlugin]
    });
    if (!changed || result === null || typeof result.code !== "string") return null;
    if (result.map === null || result.map === void 0) return { code: result.code };
    const map = result.map;
    return {
      code: result.code,
      map: {
        file: map.file,
        version: map.version,
        mappings: map.mappings,
        names: map.names,
        sourceRoot: map.sourceRoot,
        sources: map.sources,
        sourcesContent: map.sourcesContent
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[visdiff] source injection skipped for ${file}: ${message}`);
    return null;
  }
}

export {
  VISDIFF_BASE,
  createVisdiffHandler,
  startStandaloneServer,
  injectReactSource
};
