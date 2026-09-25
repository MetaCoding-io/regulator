/**
 * The control room server: a read-only projection of a definition and any
 * number of instances, served as one page plus one JSON endpoint.
 *
 * It owns no state and accepts no writes — every non-GET request is refused
 * with 405. The moment this grows a "raise budget" route it has become an
 * authority surface (docs/archive/2026-09/CONTROL-REGISTRY.md §6), so it will not.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readDefinition, readInstance, type DefinitionView, type InstanceView } from "@metacoding.io/regulator";
import { renderPage } from "./page.js";

export interface ControlRoomOptions {
  definitionDir?: string;
  instanceDirs: string[];
  now?: () => number;
}

export interface ControlRoomView {
  generatedAt: string;
  definition: DefinitionView | undefined;
  instances: InstanceView[];
}

export async function readControlRoom(options: ControlRoomOptions): Promise<ControlRoomView> {
  const now = options.now ?? Date.now;
  const instances: InstanceView[] = [];
  for (const dir of options.instanceDirs) instances.push(await readInstance(dir, now));
  return {
    generatedAt: new Date(now()).toISOString(),
    definition: options.definitionDir ? await readDefinition(options.definitionDir) : undefined,
    instances,
  };
}

function send(res: ServerResponse, status: number, type: string, body: string, headers: Record<string, string> = {}): void {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store", ...headers });
  res.end(body);
}

export function createControlRoomServer(options: ControlRoomOptions): Server {
  const page = renderPage();
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method !== "GET" && req.method !== "HEAD") {
      send(res, 405, "application/json", JSON.stringify({ error: "the control room is read-only" }), { allow: "GET, HEAD" });
      return;
    }
    if (url.pathname === "/") {
      send(res, 200, "text/html; charset=utf-8", page);
      return;
    }
    if (url.pathname === "/api/status") {
      try {
        const view = await readControlRoom(options);
        send(res, 200, "application/json", JSON.stringify(view));
      } catch (error) {
        send(res, 500, "application/json", JSON.stringify({ error: (error as Error).message }));
      }
      return;
    }
    send(res, 404, "application/json", JSON.stringify({ error: `no such path: ${url.pathname}` }));
  });
}
