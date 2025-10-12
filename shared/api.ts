/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

/**
 * Chat request/response types for the Gateway-backed /api/chat route
 */
export interface ChatRequest {
  prompt: string;
}

export interface ChatResponse {
  reply: string;
  status: number;
  error?: string;
}
