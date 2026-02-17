import { query } from "@anthropic-ai/claude-agent-sdk";
import { Composio } from "@composio/core";

// Initialize Composio
const composio = new Composio({
  apiKey: "ak_CuIEkjnTkISLp1yeOX84",
});

const externalUserId = "pg-test-0f1d8883-5140-4b78-9a37-b3cb37f8872d";

// Create a tool router session
console.log("Creating Composio session...");
const session = await composio.create(externalUserId);
console.log("Session created. MCP URL:", session.mcp?.url ? "OK" : "MISSING");

// Query Claude with MCP tools
console.log("Sending query to Claude...");
const stream = await query({
  prompt: "Send an email to support@synthex.social with the subject 'Hello from Composio' and the body 'This is a test email!'",
  options: {
    model: "claude-sonnet-4-5-20250929",
    permissionMode: "bypassPermissions",
    mcpServers: {
      composio: session.mcp,
    },
  },
});

// Stream the response
for await (const event of stream) {
  if (event.type === "result" && event.subtype === "success") {
    process.stdout.write(event.result);
  }
}

console.log("\nDone.");
