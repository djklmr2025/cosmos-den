const fromVite = (import.meta as any)?.env?.VITE_API_BASE;
const fromWindow = typeof window !== 'undefined' ? window.location.origin : '';

export const API_BASE =
  (typeof fromVite === 'string' && fromVite.trim().length > 0 ? fromVite : '') ||
  fromWindow ||
  'http://127.0.0.1:3000';