#!/usr/bin/env tsx
/**
 * fj-mcp-client — direct MCP client for FluffyJaws.
 *
 * Spawns `fj mcp` as a stdio MCP server and communicates via JSON-RPC 2.0.
 * Eliminates the file-based bridge and the parent Claude Code session dependency.
 *
 * Usage:
 *   import { fjMcp } from './fj-mcp-client.js';
 *   const result = await fjMcp.callTool('fluffyjaws_chat', { message: 'what is EDS?' });
 *   const text   = await fjMcp.chat('what is the AEM block model?');
 */
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { createInterface } from "readline";

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
};

type JsonRpcNotification = {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

type McpToolResult = {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
};

type PendingCall = {
  resolve: (value: McpToolResult) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
};

class FjMcpClient {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingCall>();
  private ready = false;
  private available: boolean | null = null; // null = untested
  private initPromise: Promise<boolean> | null = null;

  /** Initialize the fj mcp process. Returns true if VPN/auth is available. */
  async init(): Promise<boolean> {
    if (this.available !== null) return this.available;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<boolean> {
    return new Promise((resolve) => {
      let proc: ChildProcessWithoutNullStreams;
      try {
        proc = spawn("fj", ["mcp"], {
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch {
        this.available = false;
        resolve(false);
        return;
      }

      let stderrBuf = "";
      proc.stderr.on("data", (d: Buffer) => {
        stderrBuf += d.toString();
        // fj prints VPN error to stderr early
        if (stderrBuf.includes("VPN required") || stderrBuf.includes("connect to VPN")) {
          this.available = false;
          proc.kill();
          resolve(false);
        }
      });

      proc.on("error", () => {
        this.available = false;
        resolve(false);
      });

      proc.on("exit", (code) => {
        if (!this.available) return; // already resolved
        this.available = false;
        this.ready = false;
        this.proc = null;
        // Reject all pending calls
        for (const [, pending] of this.pending) {
          clearTimeout(pending.timer);
          pending.reject(new Error("fj mcp process exited unexpectedly"));
        }
        this.pending.clear();
      });

      const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });
      rl.on("line", (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let msg: JsonRpcResponse;
        try {
          msg = JSON.parse(trimmed);
        } catch {
          return; // skip non-JSON lines
        }
        if (msg.id === undefined) return; // notification, ignore

        const pending = this.pending.get(msg.id);
        if (!pending) return;

        clearTimeout(pending.timer);
        this.pending.delete(msg.id);

        if (msg.error) {
          pending.reject(new Error(`fj.mcp error ${msg.error.code}: ${msg.error.message}`));
        } else {
          pending.resolve(msg.result as McpToolResult);
        }

        // If this was the init response, mark ready and resolve
        if (msg.id === 1 && !this.ready) {
          this.ready = true;
          this.available = true;
          this.proc = proc;
          // Send initialized notification
          this._send({ jsonrpc: "2.0", method: "notifications/initialized" } as JsonRpcNotification);
          resolve(true);
        }
      });

      // Send MCP initialize
      const initMsg: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "tokenmiser", version: "1.0" },
        },
      };
      // Give the process 8s to connect (VPN latency)
      const initTimeout = setTimeout(() => {
        if (!this.available) {
          this.available = false;
          proc.kill();
          resolve(false);
        }
      }, 8000);
      proc.once("spawn", () => {
        this._writeLine(proc, JSON.stringify(initMsg));
      });

      // Clean up init timeout when resolved
      this.initPromise?.then(() => clearTimeout(initTimeout)).catch(() => clearTimeout(initTimeout));
    });
  }

  private _send(msg: JsonRpcRequest | JsonRpcNotification): void {
    if (!this.proc) return;
    this._writeLine(this.proc, JSON.stringify(msg));
  }

  private _writeLine(proc: ChildProcessWithoutNullStreams, line: string): void {
    proc.stdin.write(line + "\n");
  }

  /**
   * Call a specific FluffyJaws MCP tool.
   * Returns the text content of the result, or throws if unavailable/error.
   */
  async callTool(
    toolName: string,
    args: Record<string, unknown>,
    timeoutMs = 60_000,
  ): Promise<string> {
    const ok = await this.init();
    if (!ok) throw new Error("fj mcp unavailable (VPN required or fj not installed)");

    const id = this.nextId++;
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`fj.mcp timeout calling ${toolName} after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (result: McpToolResult) => {
          if (result.isError) {
            reject(new Error(result.content.map((c) => c.text).join("\n")));
          } else {
            resolve(result.content.map((c) => c.text).join("\n"));
          }
        },
        reject,
        timer,
      });

      this._send(req);
    });
  }

  /**
   * Simple one-shot chat query — routes to fluffyjaws_chat.
   */
  async chat(message: string, timeoutMs = 60_000): Promise<string> {
    return this.callTool("fluffyjaws_chat", { message }, timeoutMs);
  }

  /**
   * Check availability without initializing (returns null if untested).
   */
  get isAvailable(): boolean | null {
    return this.available;
  }

  /** Graceful shutdown. */
  shutdown(): void {
    if (this.proc) {
      this.proc.stdin.end();
      this.proc.kill();
      this.proc = null;
    }
    this.ready = false;
    this.available = null;
    this.initPromise = null;
  }
}

/** Singleton instance shared across the executor process. */
export const fjMcp = new FjMcpClient();

// If run directly: quick smoke test
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    console.log("Testing fj mcp client...");
    const ok = await fjMcp.init();
    if (!ok) {
      console.error("❌ fj mcp unavailable (check VPN)");
      process.exit(1);
    }
    console.log("✅ fj mcp connected");
    try {
      const result = await fjMcp.chat("What is AEM Edge Delivery Services in one sentence?");
      console.log("Response:", result.substring(0, 200));
    } catch (e) {
      console.error("Tool call failed:", e);
    }
    fjMcp.shutdown();
    process.exit(0);
  })();
}
