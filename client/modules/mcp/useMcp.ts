export type McpHealth = {
  ok?: boolean;
  result?: any;
  error?: string;
};

export type McpChatResult = {
  ok?: boolean;
  result?: any;
  error?: string;
};

export function useMcp() {
  async function health(): Promise<McpHealth> {
    const res = await fetch("/api/mcp/health", { method: "POST" });
    const data = await res.json();
    return data;
  }

  async function chat(prompt: string): Promise<McpChatResult> {
    const res = await fetch("/api/mcp/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    return data;
  }

  return { health, chat };
}