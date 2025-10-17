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
 * Contractos compartidos para /api/chat
 */
export interface ChatRequest {
  /** Prompt principal u objetivo de la tarea */
  prompt: string;
  /** Contexto opcional (metadata estructurada que el gateway/IA puede usar) */
  context?: Record<string, any>;
  /** Acción opcional soportada por el gateway (echo, generate, etc.) */
  action?: string;
  /** Parámetros opcionales específicos de la acción */
  params?: Record<string, any>;
}

export interface ChatResponse {
  /** Texto de respuesta del gateway/IA */
  reply: string;
  /** Código de estado HTTP reflejado en la respuesta */
  status: number;
  /** Mensaje de error (si aplica) */
  error?: string;
}
