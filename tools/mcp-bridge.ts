#!/usr/bin/env tsx
/**
 * mcp-bridge — client side of the MCP handshake.
 *
 * The executor calls this to delegate a step to the PARENT Claude Code session,
 * which has real MCP tool access (FluffyJaws, Experience League, etc.).
 *
 * Protocol:
 *   1. Write  .claude/mcp-requests/<stepId>.json   { stepId, tool, args, targetFile }
 *   2. Poll   .claude/mcp-responses/<stepId>.json  every 1s, up to timeoutMs
 *   3. Return { content, status } or throw on timeout
 *
 * The parent session runs tools/mcp-watcher.sh (or watches via CronCreate) and
 * calls the real MCP tool, writing the response file.
 */
import fs from 'fs';
import path from 'path';

const REQ_DIR = path.join('.claude', 'mcp-requests');
const RES_DIR = path.join('.claude', 'mcp-responses');

export type McpRequest = {
  stepId: string;
  tool: string;           // e.g. "fluffyjaws_chat", "experience_league_documentation_search"
  args: Record<string, unknown>;
  targetFile?: string;    // if set, the parent writes content directly to this file
  description?: string;
};

export type McpResponse = {
  stepId: string;
  status: 'ok' | 'error';
  content?: string;
  errorMessage?: string;
};

export async function mcpRequest(
  req: McpRequest,
  timeoutMs = 60_000,
  pollIntervalMs = 1_000,
): Promise<McpResponse> {
  fs.mkdirSync(REQ_DIR, { recursive: true });
  fs.mkdirSync(RES_DIR, { recursive: true });

  const reqFile = path.join(REQ_DIR, `${req.stepId}.json`);
  const resFile = path.join(RES_DIR, `${req.stepId}.json`);

  // Clean up any stale response
  if (fs.existsSync(resFile)) fs.unlinkSync(resFile);

  // Write request
  fs.writeFileSync(reqFile, JSON.stringify(req, null, 2), 'utf8');

  // Poll for response
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    if (fs.existsSync(resFile)) {
      const res: McpResponse = JSON.parse(fs.readFileSync(resFile, 'utf8'));
      fs.unlinkSync(reqFile);
      fs.unlinkSync(resFile);
      return res;
    }
  }

  // Timeout — clean up request file
  fs.unlink(reqFile, () => {});
  throw new Error(`mcp-bridge: timeout waiting for response to ${req.stepId} (${timeoutMs}ms)`);
}

/** Check whether the parent session MCP bridge is active */
export function isBridgeActive(): boolean {
  return fs.existsSync(path.join('.claude', 'mcp-bridge.active'));
}
