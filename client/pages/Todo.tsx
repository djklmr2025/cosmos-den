import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type TodoItem = { id: string; text: string; done: boolean; createdAt: number };

export default function TodoPage() {
  const [items, setItems] = useState<TodoItem[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/todo");
      const data = await res.json();
      if (data?.ok) setItems(data.items || []);
      else setError(data?.error || "Error al cargar");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function addItem() {
    const t = text.trim();
    if (!t) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/todo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const data = await res.json();
      if (data?.ok && data.item) {
        setItems((prev) => [data.item, ...prev]);
        setText("");
      } else setError(data?.error || "No se pudo crear");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  }

  async function toggleItem(id: string) {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/todo/${id}/toggle`, { method: "PATCH" });
      const data = await res.json();
      if (data?.ok && data.item) {
        setItems((prev) => prev.map((it) => it.id === id ? data.item : it));
      } else setError(data?.error || "No se pudo actualizar");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  }

  async function deleteItem(id: string) {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/todo/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data?.ok) setItems((prev) => prev.filter((it) => it.id !== id));
      else setError(data?.error || "No se pudo eliminar");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Todo App</h1>
        <Link to="/" className="text-sm text-blue-600 hover:underline">Volver</Link>
      </div>
      <div className="flex gap-2 mb-6">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nueva tarea"
          className="flex-1 border rounded px-3 py-2"
        />
        <button onClick={addItem} className="bg-blue-600 text-white px-4 py-2 rounded">Agregar</button>
      </div>
      {error && <div className="text-red-600 mb-3">{error}</div>}
      {loading && <div className="text-gray-600 mb-3">Procesando...</div>}
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between border rounded px-3 py-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={it.done} onChange={() => toggleItem(it.id)} />
              <span className={it.done ? "line-through text-gray-500" : ""}>{it.text}</span>
            </div>
            <button onClick={() => deleteItem(it.id)} className="text-red-600">Eliminar</button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-gray-500">Sin tareas. Crea la primera arriba.</li>
        )}
      </ul>
    </div>
  );
}