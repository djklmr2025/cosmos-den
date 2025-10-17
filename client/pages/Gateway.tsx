import { useState } from "react";

type Action = "list" | "read" | "write" | "delete" | "mkdir" | "copy" | "move";

async function callGateway(action: Action, params: Record<string, any>) {
  const res = await fetch("/api/gateway", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, params }),
  });
  return res.json();
}

export default function GatewayPage() {
  const [action, setAction] = useState<Action>("list");
  const [path, setPath] = useState<string>(".");
  const [content, setContent] = useState<string>("");
  const [src, setSrc] = useState<string>("");
  const [dest, setDest] = useState<string>("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setResult(null);
    try {
      const params: Record<string, any> = {};
      if (action === "list" || action === "read" || action === "delete" || action === "mkdir") {
        params.path = path || ".";
      }
      if (action === "write") {
        params.path = path || "status/note.txt";
        params.content = content;
      }
      if (action === "copy" || action === "move") {
        params.src = src; params.dest = dest;
      }
      const data = await callGateway(action, params);
      // reply es string; intentar formatearlo como JSON si corresponde
      let parsed: any; let raw = data?.reply ?? "";
      try { parsed = JSON.parse(raw); } catch { parsed = raw; }
      setResult({ status: data?.status, reply: parsed });
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: "system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600 }}>Gateway A.I.D.A. — Pruebas rápidas</h1>
      <p style={{ marginTop: 6, color: "#555" }}>Usa el proxy <code>/api/gateway</code> para operar sobre el Gateway remoto.</p>

      <form onSubmit={onSubmit} style={{ marginTop: 16, display: "grid", gap: 10, maxWidth: 720 }}>
        <label>
          Acción
          <select value={action} onChange={(e) => setAction(e.target.value as Action)} style={{ marginLeft: 8 }}>
            <option value="list">list</option>
            <option value="read">read</option>
            <option value="write">write</option>
            <option value="delete">delete</option>
            <option value="mkdir">mkdir</option>
            <option value="copy">copy</option>
            <option value="move">move</option>
          </select>
        </label>

        {(action === "list" || action === "read" || action === "write" || action === "delete" || action === "mkdir") && (
          <label>
            Path
            <input type="text" value={path} onChange={(e) => setPath(e.target.value)} placeholder={action === "list" ? "." : "ruta/archivo.txt"} style={{ marginLeft: 8, width: 360 }} />
          </label>
        )}

        {action === "write" && (
          <label>
            Content
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} style={{ display: "block", marginTop: 6, width: 600 }} />
          </label>
        )}

        {(action === "copy" || action === "move") && (
          <div style={{ display: "grid", gap: 8 }}>
            <label>
              Src
              <input type="text" value={src} onChange={(e) => setSrc(e.target.value)} placeholder="origen.ext" style={{ marginLeft: 8, width: 360 }} />
            </label>
            <label>
              Dest
              <input type="text" value={dest} onChange={(e) => setDest(e.target.value)} placeholder="destino.ext" style={{ marginLeft: 8, width: 360 }} />
            </label>
          </div>
        )}

        <button type="submit" disabled={busy} style={{ width: 140, padding: "8px 12px", background: "#111", color: "white", borderRadius: 6 }}>
          {busy ? "Ejecutando..." : "Ejecutar"}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: 12, color: "#b00020" }}>Error: {error}</div>
      )}

      <div style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Resultado</h2>
        <pre style={{ marginTop: 8, padding: 12, background: "#f6f8fa", borderRadius: 8, overflowX: "auto" }}>
          {result ? JSON.stringify(result, null, 2) : "(sin resultado)"}
        </pre>
      </div>

      <div style={{ marginTop: 24 }}>
        <a href="/lab" style={{ color: "#0366d6" }}>Ir al Lab</a>
      </div>
    </div>
  );
}