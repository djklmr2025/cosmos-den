import { useState, useCallback } from "react";
import type { ChatRequest, ChatResponse } from "@shared/api";

/**
 * Hook de cliente para interactuar con el Gateway vía /api/chat
 * No expone ninguna API key en el cliente: todo pasa por el servidor.
 */
export function useChatGateway() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (prompt: string): Promise<string> => {
    setLoading(true);
    setError(null);
    try {
      const body: ChatRequest = { prompt };
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const data = (await response.json()) as ChatResponse & Record<string, any>;
      // Preferimos la forma tipada del servidor (reply), pero toleramos otras del Gateway (output/result)
      const reply = data.reply ?? data.output ?? data.result ?? JSON.stringify(data, null, 2);
      return reply as string;
    } catch (err: any) {
      setError(err?.message ?? "Error desconocido");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { send, loading, error };
}