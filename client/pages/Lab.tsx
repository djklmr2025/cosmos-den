import { useEffect, useMemo, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Editor } from "@monaco-editor/react";
import { BuilderMode } from "@/components/builder-mode";
import { cn } from "@/lib/utils";
import { apiFsAppend } from "@/lib/fs";
import { Folder, FileText, RefreshCw, Save, Terminal as TerminalIcon, ChevronRight, ChevronDown, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
// Chat deshabilitado en el panel derecho del Lab por usabilidad

type TreeItem = {
  name: string;
  path: string;
  type: "dir" | "file";
  children?: TreeItem[];
  expanded?: boolean;
};

type OpenTab = {
  path: string;
  content: string;
  dirty: boolean;
};

async function apiJson(url: string, body?: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

export default function Lab() {
  const [root, setRoot] = useState<TreeItem | null>(null);
  const [loadingTree, setLoadingTree] = useState(false);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [termCmd, setTermCmd] = useState<string>("");
  const [termOut, setTermOut] = useState<string>("");
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [aiLog, setAiLog] = useState<string[]>([]);
  const [connectedRoot, setConnectedRoot] = useState<string | null>(null);
  const logAi = (msg: string) => {
    const ts = new Date();
    const hh = ts.toLocaleTimeString();
    setAiLog((prev) => [...prev, `[${hh}] ${msg}`]);
  };

  // Cargar el árbol raíz
  useEffect(() => {
    void loadDir(".");
  }, []);

  const findNode = (node: TreeItem | null, path: string): TreeItem | null => {
    if (!node) return null;
    if (node.path === path) return node;
    if (node.children) {
      for (const c of node.children) {
        const found = findNode(c, path);
        if (found) return found;
      }
    }
    return null;
  };

  async function loadDir(relPath: string) {
    try {
      setLoadingTree(true);
      const data = await apiJson("/fs/list", { path: relPath });
      if (!data?.ok) throw new Error(data?.error || "Error listando directorio");
      const items: TreeItem[] = (data.items || []).map((it: any) => ({
        name: it.name,
        path: it.path,
        type: it.type,
        children: it.type === "dir" ? [] : undefined,
      }));
      if (relPath === ".") {
        setRoot({ name: "workspace", path: ".", type: "dir", children: items, expanded: true });
      } else {
        setRoot((prev) => {
          const copy = prev ? structuredClone(prev) : null;
          const target = findNode(copy, relPath);
          if (target && target.type === "dir") {
            target.children = items;
            target.expanded = true;
          }
          return copy;
        });
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoadingTree(false);
    }
  }

  async function toggleDir(node: TreeItem) {
    if (node.type !== "dir") return;
    if (!node.expanded) {
      await loadDir(node.path);
    } else {
      // colapsar
      setRoot((prev) => {
        const copy = prev ? structuredClone(prev) : null;
        const target = findNode(copy, node.path);
        if (target) target.expanded = false;
        return copy;
      });
    }
  }

  async function openFile(path: string) {
    const data = await apiJson("/fs/read", { path });
    if (!data?.ok) return;
    const existing = tabs.find((t) => t.path === path);
    if (existing) {
      setActivePath(path);
    } else {
      const tab: OpenTab = { path, content: data.content || "", dirty: false };
      setTabs((prev) => [...prev, tab]);
      setActivePath(path);
    }
    // Ajustar modo de vista si es HTML
    if (/\.html?$/i.test(path)) {
      setViewMode("preview");
    } else {
      setViewMode("edit");
    }
  }

  async function saveActive() {
    if (!activePath) return;
    const tab = tabs.find((t) => t.path === activePath);
    if (!tab) return;
    const res = await apiJson("/fs/write", { path: tab.path, content: tab.content });
    if (res?.ok) {
      setTabs((prev) => prev.map((t) => (t.path === tab.path ? { ...t, dirty: false } : t)));
    }
  }

  function closeTab(path: string) {
    setTabs((prev) => prev.filter((t) => t.path !== path));
    if (activePath === path) {
      const next = tabs.find((t) => t.path !== path);
      setActivePath(next?.path ?? null);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      logAi(`Upload: ${file.name}`);
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const contentBase64 = btoa(binary);
      const destDir = "uploads"; // carpeta por defecto dentro del workspace
      const res = await apiJson("/fs/upload", {
        path: destDir,
        filename: file.name,
        contentBase64,
      });
      if (res?.ok) {
        await loadDir(".");
        setTermOut((prev) => prev + `\n[upload] ${file.name} -> ${destDir}/`);
        logAi(`Upload completado: ${file.name}`);
      }
      e.target.value = ""; // reset input
    } catch (err: any) {
      setTermOut((prev) => prev + `\n[upload error] ${err?.message || String(err)}`);
      logAi(`Upload error: ${err?.message || String(err)}`);
    }
  }

  async function clearWorkspace() {
    try {
      const resp = await apiJson('/fs/clear', { confirm: true });
      if (!resp?.ok) throw new Error(resp?.error || 'No se pudo vaciar el workspace');
      setTabs([]);
      setActivePath(null);
      setTermOut((prev) => prev + "\n[workspace] Vacío: se eliminaron todos los archivos.");
      logAi('Workspace vaciado: todos los archivos eliminados');
      await loadDir('.');
    } catch (err:any) {
      setTermOut((prev) => prev + `\n[clear error] ${err.message || String(err)}`);
      logAi(`Error al vaciar workspace: ${err.message || String(err)}`);
    } finally {
      setShowClearConfirm(false);
    }
  }

  // Conectar una carpeta local y importar su contenido al workspace (external/<carpeta>)
  async function handleConnectFolder() {
    try {
      // @ts-expect-error API experimental
      if (!window.showDirectoryPicker) {
        setTermOut((prev) => prev + "\n[connect] Tu navegador no soporta selección de carpeta.");
        return;
      }
      // @ts-expect-error API experimental
      const dirHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker();
      logAi(`Conectar carpeta: ${(dirHandle as any).name || 'carpeta'}`);
      const baseDest = `external/${(dirHandle as any).name || "carpeta"}`;
      let count = 0;
      async function importHandle(handle: any, relDest: string) {
        if (handle.kind === "file") {
          const file = await handle.getFile();
          const buf = await file.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const contentBase64 = btoa(binary);
          await apiJson("/fs/upload", { path: relDest, filename: file.name, contentBase64 });
          count++;
        } else if (handle.kind === "directory") {
          // @ts-expect-error entries existe
          for await (const [name, child] of handle.entries()) {
            await importHandle(child, `${relDest}/${handle.name}`);
          }
        }
      }
      // @ts-expect-error entries existe
      for await (const [name, child] of (dirHandle as any).entries()) {
        await importHandle(child, baseDest);
      }
      await loadDir(".");
      setTermOut((prev) => prev + `\n[connect] Importados ${count} archivos desde carpeta local -> ${baseDest}/`);
      logAi(`Importación completada: ${count} archivos a ${baseDest}/`);
      setConnectedRoot(baseDest);
    } catch (err: any) {
      setTermOut((prev) => prev + `\n[connect error] ${err?.message || String(err)}`);
      logAi(`Conectar carpeta error: ${err?.message || String(err)}`);
    }
  }

  // Desmontar carpeta importada (elimina solo la copia en workspace)
  async function unmountConnectedRoot() {
    try {
      if (!connectedRoot) {
        setTermOut((prev) => prev + "\n[root out] No hay carpeta conectada");
        return;
      }
      logAi(`Root Out: desmontar ${connectedRoot}`);
      const resp = await apiJson('/fs/delete', { path: connectedRoot });
      if (!resp?.ok) throw new Error(resp?.error || 'No se pudo desmontar carpeta');
      setConnectedRoot(null);
      await loadDir('.');
      setTermOut((prev) => prev + `\n[root out] Carpeta desmontada: ${connectedRoot}`);
      logAi('Root Out completado');
    } catch (err:any) {
      setTermOut((prev) => prev + `\n[root out error] ${err.message || String(err)}`);
      logAi(`Root Out error: ${err.message || String(err)}`);
    }
  }

  async function runTerminal() {
    if (!termCmd.trim()) return;
    setTermOut("Running: " + termCmd + "\n\n");
    logAi(`Terminal: ${termCmd}`);
    try {
      const parts = termCmd.split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1);
      const res = await fetch("/api/terminal/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd, args }),
      });
      const data = await res.json();
      if (data?.ok) {
        setTermOut((prev) => prev + (data.output || "") + `\n\n[exit ${data.code}]`);
        logAi(`Terminal completado (exit ${data.code})`);
      } else {
        setTermOut((prev) => prev + (data.error || "Error"));
        logAi(`Terminal error: ${data.error || 'Error'}`);
      }
    } catch (e: any) {
      setTermOut((prev) => prev + (e?.message || String(e)));
      logAi(`Terminal excepción: ${e?.message || String(e)}`);
    }
  }

  function onBuilderCommand(cmd: string) {
    setTermOut((prev) => prev + `\n[builder] ${cmd}`);
  }

  const activeTab = useMemo(() => tabs.find((t) => t.path === activePath) ?? null, [tabs, activePath]);
  const editorRef = useRef<any>(null);

  function renderTree(node: TreeItem | null): JSX.Element | null {
    if (!node) return null;
    return (
      <div className="text-xs">
        <div className="flex items-center gap-2 py-1">
          {node.type === "dir" ? (
            <button
              className="rounded p-1 hover:bg-white/10"
              onClick={() => toggleDir(node)}
              title={node.expanded ? "Colapsar" : "Expandir"}
            >
              {node.expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            </button>
          ) : (
            <span className="inline-block w-4" />
          )}
          {node.type === "dir" ? (
            <Folder className="size-3 text-primary" />
          ) : (
            <FileText className="size-3 text-muted-foreground" />
          )}
          <button
            className={cn("truncate text-left", node.type === "file" && "hover:text-primary")}
            onClick={() => (node.type === "file" ? openFile(node.path) : toggleDir(node))}
            title={node.path}
          >
            {node.name}
          </button>
        </div>
        {node.expanded && node.children && node.children.length > 0 ? (
          <div className="ml-4 border-l border-white/10 pl-2">
            {node.children.map((c) => (
              <div key={c.path}>{renderTree(c)}</div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  // Estado para chat compacto en el panel derecho
  const [compactInput, setCompactInput] = useState("");
  const [compactReply, setCompactReply] = useState("");
  const [compactError, setCompactError] = useState("");
  const [compactSending, setCompactSending] = useState(false);
  const [includeFileContext, setIncludeFileContext] = useState(true);
  const [compactResult, setCompactResult] = useState<{action?: string; path?: string; content?: string} | null>(null);

  function parseCompactCommand(text: string) {
    const t = text.toLowerCase();
    // Órdenes de edición
    const reAppend = /(append|sumar|agregar|añadir|anadir)\s+(?:a\s+)?(?:archivo|file)\s+([\w\-]+\.[a-z0-9]+)\b/i;
    const reOverwrite = /(reemplazar|sobrescribir|overwrite|editar)\s+(?:archivo|file)\s+([\w\-]+\.[a-z0-9]+)\b/i;
    // Mapa de lenguajes → nombre por defecto
    const defaultNameFor = (lang: string): string => {
      switch (lang) {
        case 'python':
        case 'py':
          return 'script.py';
        case 'javascript':
        case 'js':
        case 'node':
        case 'nodejs':
          return 'script.js';
        case 'typescript':
        case 'ts':
          return 'script.ts';
        case 'tsx':
          return 'App.tsx';
        case 'jsx':
          return 'App.jsx';
        case 'html':
          return 'index.html';
        case 'css':
          return 'styles.css';
        case 'json':
          return 'data.json';
        case 'markdown':
        case 'md':
          return 'README.md';
        case 'yaml':
        case 'yml':
          return 'config.yaml';
        case 'toml':
          return 'config.toml';
        case 'ini':
          return 'config.ini';
        case 'env':
          return '.env';
        case 'bash':
        case 'sh':
          return 'script.sh';
        case 'sql':
          return 'query.sql';
        case 'php':
          return 'index.php';
        case 'ruby':
          return 'script.rb';
        case 'swift':
          return 'main.swift';
        case 'go':
          return 'main.go';
        case 'rust':
          return 'main.rs';
        case 'java':
          return 'Main.java';
        case 'kotlin':
          return 'Main.kt';
        case 'csharp':
        case 'cs':
          return 'Program.cs';
        case 'vue':
          return 'App.vue';
        case 'svelte':
          return 'App.svelte';
        case 'dockerfile':
          return 'Dockerfile';
        default:
          return 'archivo.txt';
      }
    };
    // Detectar bloque de código con triple backticks
    const codeBlock = text.match(/```\s*([a-z0-9\-]+)?\s*\n([\s\S]*?)```/i);
    if (codeBlock) {
      const lang = (codeBlock[1] || "").toLowerCase();
      const code = codeBlock[2];
      const nameFromHeader = code.match(/^(?:#|\/\/|\/\*)\s*(?:file|archivo|nombre|fichero)\s*:?\s*([\w\-]+\.[a-z0-9]+)/i);
      const nameFromLine = text.match(/filename\s*:?\s*([\w\-]+\.[a-z0-9]+)/i);
      const filename = nameFromHeader?.[1] || nameFromLine?.[1] || defaultNameFor(lang);
      // Si el prompt pide agregar o sobrescribir, respetar esa acción
      const mAppend = text.match(reAppend);
      if (mAppend) {
        return { action: "append-file", filename: mAppend[2], content: code } as const;
      }
      const mOverwrite = text.match(reOverwrite);
      if (mOverwrite) {
        return { action: "overwrite-file", filename: mOverwrite[2], content: code } as const;
      }
      return { action: "create-file", filename, content: code } as const;
    }
    // Detectar encabezados sin backticks: "# python file" y/o "# file: nombre.ext" al inicio
    const lines = text.split(/\r?\n/);
    const first = (lines[0] || "").trim();
    // Encabezados de edición al inicio
    const headerOp = first.match(/^(?:#|\/\/|\/\*)\s*(append|sumar|agregar|añadir|anadir|overwrite|reemplazar|sobrescribir|editar)\s*:?\s*([\w\-]+\.[a-z0-9]+)/i);
    if (headerOp) {
      const op = headerOp[1].toLowerCase();
      const filename = headerOp[2];
      const content = lines.slice(1).join("\n");
      return { action: op === 'append' || op === 'sumar' || op === 'agregar' || op === 'añadir' || op === 'anadir' ? 'append-file' : 'overwrite-file', filename, content } as const;
    }
    const headerLang = first.match(/^(?:#|\/\/|\/\*)\s*(python|py|javascript|js|typescript|ts|tsx|jsx|html|css|json|markdown|md|yaml|yml|toml|ini|env|bash|sh|sql|php|ruby|swift|go|rust|java|kotlin|csharp|cs|vue|svelte|dockerfile)\s+(?:file|archivo|fichero)\b/i);
    const headerFile = first.match(/^(?:#|\/\/|\/\*)\s*(?:file|archivo|nombre|fichero)\s*:?\s*([\w\-]+\.[a-z0-9]+)/i);
    if (headerLang || headerFile) {
      const lang = (headerLang?.[1] || "").toLowerCase();
      const nameFromHeader = headerFile?.[1];
      const filename = nameFromHeader || defaultNameFor(lang);
      const content = lines.slice(1).join("\n");
      return { action: "create-file", filename, content } as const;
    }
    // Agregar/sobrescribir sin backticks
    const mAppend2 = text.match(reAppend);
    if (mAppend2) {
      const filename = mAppend2[2];
      let content = "";
      const qd = text.match(/que diga\s+([\s\S]+)/i);
      if (qd) content = qd[1].trim();
      const cont = text.match(/contenido\s*:\s*([\s\S]+)/i);
      if (!content && cont) content = cont[1].trim();
      const quoted = text.match(/"([\s\S]+)"/);
      if (!content && quoted) content = quoted[1];
      if (!content) content = text.replace(mAppend2[0], "").trim();
      return { action: 'append-file', filename, content } as const;
    }
    const mOverwrite2 = text.match(reOverwrite);
    if (mOverwrite2) {
      const filename = mOverwrite2[2];
      let content = "";
      const qd = text.match(/que diga\s+([\s\S]+)/i);
      if (qd) content = qd[1].trim();
      const cont = text.match(/contenido\s*:\s*([\s\S]+)/i);
      if (!content && cont) content = cont[1].trim();
      const quoted = text.match(/"([\s\S]+)"/);
      if (!content && quoted) content = quoted[1];
      if (!content) content = text.replace(mOverwrite2[0], "").trim();
      return { action: 'overwrite-file', filename, content } as const;
    }
    // crear archivo: "crea un archivo <nombre>.ext que diga <contenido>"
    if (/(crea|crear|haz) (un )?archivo/.test(t)) {
      // filename
      const fileMatch = text.match(/([\w\-]+\.[a-z0-9]+)/i);
      const filename = fileMatch?.[1] || "archivo.txt";
      // content after "que diga" or "contenido:" or quotes
      let content = "";
      const qd = text.match(/que diga\s+([\s\S]+)/i);
      if (qd) content = qd[1].trim();
      const cont = text.match(/contenido\s*:\s*([\s\S]+)/i);
      if (!content && cont) content = cont[1].trim();
      const quoted = text.match(/"([\s\S]+)"/);
      if (!content && quoted) content = quoted[1];
      if (!content) content = "hola mundo";
      return { action: "create-file", filename, content } as const;
    }
    // imprimir archivo: "print <archivo>" o "mostrar <archivo>"
    const printMatch = text.match(/\b(print|mostrar|leer)\s+([\w\-]+\.[a-z0-9]+)\b/i);
    if (printMatch) {
      return { action: "print-file", filename: printMatch[2] } as const;
    }
    return { action: "chat" } as const;
  }

  async function sendCompact() {
    const base = compactInput.trim();
    if (!base) return;
    setCompactSending(true);
    setCompactError("");
    setCompactResult(null);
    const parsed = parseCompactCommand(base);
    try {
      if (parsed.action === "create-file") {
        const path = parsed.filename;
        const content = parsed.content;
        logAi(`Crear archivo: ${path} (${content.length} bytes)`);
        const wr = await apiJson('/fs/write', { path, content });
        if (!wr?.ok) throw new Error(wr?.error || 'No se pudo escribir el archivo');
        setCompactReply(`Archivo creado: ${path}`);
        setCompactResult({ action: 'create-file', path, content });
        // refrescar árbol y abrir
        await loadDir('.');
        await openFile(path);
        setTermOut((prev) => `${prev}\n[builder] created ${path} (${content.length} bytes)`);
      } else if (parsed.action === "append-file") {
        const path = (parsed as any).filename;
        const add = (parsed as any).content || '';
        logAi(`Append archivo: ${path} (+${add.length} bytes)`);
        // Usar buffer en memoria si el archivo está abierto, para evitar perder cambios locales
        const current = (activeTab && activeTab.path === path) ? (activeTab.content || '') : ((await apiJson('/fs/read', { path }))?.content || '');
        const newContent = current + (current.endsWith('\n') ? '' : '\n') + add;
        // Persistir vía /fs/append (atómico en servidor)
        await apiFsAppend(path, add);
        // Refrescar UI inmediatamente si el archivo está abierto
        if (activeTab && activeTab.path === path) {
          setTabs((prev) => prev.map((t) => (t.path === path ? { ...t, content: newContent, dirty: false } : t)));
          // Mover cursor al final para ver el texto agregado
          try {
            const ed = editorRef.current;
            const model = ed?.getModel?.();
            if (ed && model) {
              const lineNumber = model.getLineCount();
              const column = model.getLineMaxColumn(lineNumber);
              ed.setPosition({ lineNumber, column });
              ed.focus();
            }
          } catch {}
        } else {
          await openFile(path);
        }
        setCompactReply(`Texto agregado a: ${path}`);
        setCompactResult({ action: 'append-file', path, content: add });
        await loadDir('.');
        setTermOut((prev) => `${prev}\n[builder] append ${path} (+${add.length} bytes)`);
      } else if (parsed.action === "overwrite-file") {
        const path = (parsed as any).filename;
        const content = (parsed as any).content || '';
        logAi(`Overwrite archivo: ${path} (${content.length} bytes)`);
        const wr = await apiJson('/fs/write', { path, content });
        if (!wr?.ok) throw new Error(wr?.error || 'No se pudo escribir el archivo');
        setCompactReply(`Archivo sobreescrito: ${path}`);
        setCompactResult({ action: 'overwrite-file', path, content });
        await loadDir('.');
        await openFile(path);
        setTermOut((prev) => `${prev}\n[builder] overwrite ${path} (${content.length} bytes)`);
      } else if (parsed.action === "print-file") {
        logAi(`Leer archivo: ${(parsed as any).filename}`);
        const rd = await apiJson('/fs/read', { path: (parsed as any).filename });
        if (!rd?.ok) throw new Error(rd?.error || 'No se pudo leer el archivo');
        setCompactReply(rd.content || '(vacío)');
        setCompactResult({ action: 'print-file', path: (parsed as any).filename, content: rd.content || '' });
        setTermOut((prev) => `${prev}\n[builder] print ${(parsed as any).filename}:\n${rd.content}`);
      } else {
        logAi('Chat: consulta enviada');
        const context = activeTab && includeFileContext
          ? `\n\nContexto de archivo activo:\nRuta: ${activeTab.path}\nContenido (primeros 2000 chars):\n${activeTab.content.slice(0, 2000)}`
          : "";
        const prompt = `${base}${context}`;
        const r = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
        });
        const data = await r.json();
        setCompactReply(data.reply || data.error || JSON.stringify(data));
        logAi('Chat: respuesta recibida');
      }
    } catch (err:any) {
      setCompactError(err.message || 'Error ejecutando la acción');
      logAi(`Chat error: ${err.message || String(err)}`);
    } finally {
      setCompactSending(false);
    }
  }

  return (
    <div className="h-[calc(100vh-2rem)] w-full p-2">
      {/* Top bar with back button */}
      <div className="mb-2 flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-3 py-2">
        <Link
          to="/#chat"
          className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.4em] text-muted-foreground transition hover:border-primary/50 hover:text-primary"
        >
          <ArrowLeft className="size-3" /> Regresar al chat
        </Link>
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
          <Link to="/" className="transition hover:text-primary">Inicio</Link>
          <span className="opacity-60">/</span>
          <span>Lab</span>
        </div>
      </div>
      {/* Paneles horizontales: Árbol (izquierda), Editor+Terminal (centro), Chat (derecha) */}
      <PanelGroup direction="horizontal" className="h-[calc(100%-2.75rem)] rounded-2xl border border-white/10 bg-black/40">
        {/* Sidebar */}
        <Panel defaultSize={22} minSize={18} className="flex flex-col">
          <div className="flex items-center justify-between border-b border-white/10 p-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-muted-foreground">
              <Folder className="size-3" /> Árbol
            </div>
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-xs hover:border-primary/50 hover:text-primary" title="Subir archivo al workspace">
                <input type="file" className="hidden" onChange={handleUpload} />
                Upload files
              </label>
              <button
                className="rounded-full border border-white/10 px-2 py-1 text-xs hover:border-primary/50 hover:text-primary"
                onClick={handleConnectFolder}
                title="Conectar carpeta local e importar"
              >
                Root carpeta
              </button>
              <button
                className={cn("rounded-full border px-2 py-1 text-xs", connectedRoot ? "border-white/10 hover:border-primary/50 hover:text-primary" : "border-white/5 text-muted-foreground")}
                onClick={unmountConnectedRoot}
                disabled={!connectedRoot}
                title={connectedRoot ? `Desmontar y soltar: ${connectedRoot}` : "No hay carpeta conectada"}
              >
                Root Out
              </button>
              <button
                className="rounded-full border border-destructive/40 px-2 py-1 text-xs text-destructive hover:border-destructive hover:text-destructive"
                onClick={() => setShowClearConfirm(true)}
                title="Vaciar workspace (elimina todo)"
              >
                Clean
              </button>
              <button
                className="rounded border border-white/10 px-2 py-1 text-xs hover:border-primary/50 hover:text-primary"
                onClick={() => loadDir(root?.path || ".")}
                title="Actualizar"
              >
                <RefreshCw className="size-3" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {loadingTree ? (
              <p className="text-xs text-muted-foreground">Cargando...</p>
            ) : (
              renderTree(root)
            )}
          </div>

          <div className="border-t border-white/10 p-2">
            <p className="mb-2 text-xs uppercase tracking-[0.4em] text-primary">Builder Mode</p>
            <BuilderMode onCommandGenerated={onBuilderCommand} />
          </div>
        </Panel>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
            <div className="w-[380px] rounded-2xl border border-white/10 bg-black/60 p-4 text-sm">
              <p className="mb-2 text-xs uppercase tracking-[0.35em] text-muted-foreground">Confirmación</p>
              <p className="mb-4 text-foreground">¿En verdad deseas vaciar el árbol/carpeta? Esto no tiene reintegro de archivo: eliminará todo.</p>
              <div className="flex items-center justify-end gap-2">
                <button
                  className="rounded-full border border-white/10 px-3 py-1 text-xs hover:border-primary/50 hover:text-primary"
                  onClick={() => setShowClearConfirm(false)}
                >no mejor regreso</button>
                <button
                  className="rounded-full border border-destructive px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
                  onClick={clearWorkspace}
                >si adelante</button>
              </div>
            </div>
          </div>
        )}
        <PanelResizeHandle className="w-1 bg-white/10 hover:bg-primary/40" />

        {/* Editor + Terminal stacked */}
        <Panel minSize={40} className="flex flex-col">
          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-white/10 p-2">
            <div className="flex flex-wrap gap-2">
              {tabs.map((t) => (
                <div
                  key={t.path}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-2 py-1 text-xs",
                    activePath === t.path ? "border-primary text-primary" : "border-white/10 text-muted-foreground",
                  )}
                >
                  <button onClick={() => setActivePath(t.path)} title={t.path} className="truncate max-w-[20ch]">
                    {t.path}
                  </button>
                  {t.dirty && <span className="text-yellow-400">•</span>}
                  <button onClick={() => closeTab(t.path)} className="rounded px-1 hover:text-destructive">×</button>
                </div>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {/* Controles de vista para HTML */}
              {activeTab && /\.html?$/i.test(activeTab.path) ? (
                <div className="flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-xs">
                  <button
                    className={cn("px-2", viewMode === "edit" ? "text-primary" : "text-muted-foreground")}
                    onClick={() => setViewMode("edit")}
                  >Editar</button>
                  <span className="opacity-50">|</span>
                  <button
                    className={cn("px-2", viewMode === "preview" ? "text-primary" : "text-muted-foreground")}
                    onClick={() => setViewMode("preview")}
                  >Ver</button>
                </div>
              ) : null}
              <button
                className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs hover:border-primary/50 hover:text-primary"
                onClick={saveActive}
                disabled={!activeTab}
                title="Guardar archivo activo"
              >
                <Save className="size-3" /> Guardar
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1">
            {activeTab ? (
              viewMode === "preview" && /\.html?$/i.test(activeTab.path) ? (
                <iframe
                  title="Vista previa HTML"
                  className="h-full w-full rounded-none bg-white"
                  srcDoc={activeTab.content}
                />
              ) : (
                <Editor
                  height="100%"
                  defaultLanguage="typescript"
                  path={activeTab.path}
                  value={activeTab.content}
                  onMount={(editor) => { editorRef.current = editor; }}
                  onChange={(val) => {
                    const content = val ?? "";
                    setTabs((prev) =>
                      prev.map((t) => (t.path === activeTab.path ? { ...t, content, dirty: true } : t)),
                    );
                  }}
                  options={{
                    fontSize: 13,
                    minimap: { enabled: false },
                    smoothScrolling: true,
                    scrollBeyondLastLine: false,
                  }}
                />
              )
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Abre un archivo desde el árbol para editar
              </div>
            )}
          </div>

          {/* Terminal */}
          <div className="border-t border-white/10">
            <div className="flex items-center gap-2 p-2 text-xs uppercase tracking-[0.4em] text-muted-foreground">
              <TerminalIcon className="size-3" /> Terminal
            </div>
            <div className="flex items-center gap-2 p-2">
              <input
                className="flex-1 rounded border border-white/10 bg-black/30 px-2 py-1 text-sm"
                placeholder="Comando (permitidos: node, pnpm, echo)"
                value={termCmd}
                onChange={(e) => setTermCmd(e.target.value)}
              />
              <button
                className="rounded border border-white/10 px-3 py-1 text-xs hover:border-primary/50 hover:text-primary"
                onClick={runTerminal}
                title="Ejecutar comando"
              >
                Ejecutar
              </button>
            </div>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap p-2 text-xs leading-relaxed text-muted-foreground">
              {termOut || "Salida del terminal aparecerá aquí"}
            </pre>
          </div>
        </Panel>
        <PanelResizeHandle className="w-1 bg-white/10 hover:bg-primary/40" />
        {/* Chat compacto (derecha) */}
        <Panel minSize={18} defaultSize={28} className="flex flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 p-2 text-xs uppercase tracking-[0.4em] text-muted-foreground">
            <span>Chat compacto</span>
            <div className="flex items-center gap-2">
              <button
                className="rounded-full border border-white/10 px-2 py-1 text-[10px] hover:border-primary/50 hover:text-primary"
                onClick={async () => {
                  logAi('Exportar ZIP del workspace');
                  // Exportar ZIP del workspace vía JSZip (CDN)
                  async function ensureJSZip(): Promise<any> {
                    const g: any = window as any;
                    if (g.JSZip) return g.JSZip;
                    await new Promise<void>((resolve, reject) => {
                      const s = document.createElement('script');
                      s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
                      s.onload = () => resolve();
                      s.onerror = () => reject(new Error('No se pudo cargar JSZip'));
                      document.head.appendChild(s);
                    });
                    return (window as any).JSZip;
                  }
                  async function listRec(pathRel: string): Promise<any[]> {
                    const resp = await apiJson('/fs/list', { path: pathRel });
                    if (!resp?.ok) return [];
                    const items = resp.items as any[];
                    const acc: any[] = [];
                    for (const it of items) {
                      if (it.type === 'dir') {
                        acc.push({ type: 'dir', path: it.path });
                        const sub = await listRec(it.path);
                        acc.push(...sub);
                      } else {
                        const rd = await apiJson('/fs/read', { path: it.path });
                        acc.push({ type: 'file', path: it.path, content: rd?.content ?? '' });
                      }
                    }
                    return acc;
                  }
                  try {
                    const JSZip = await ensureJSZip();
                    const zip = new JSZip();
                    const entries = await listRec('.');
                    for (const e of entries) {
                      if (e.type === 'file') {
                        zip.file(e.path === './' ? 'root' : e.path, e.content);
                      }
                    }
                    const blob = await zip.generateAsync({ type: 'blob' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'workspace.zip';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                    logAi('ZIP exportado: workspace.zip');
                  } catch (err:any) {
                    alert(err.message || 'Error exportando ZIP');
                    logAi(`Error exportando ZIP: ${err.message || String(err)}`);
                  }
                }}
              >Exportar ZIP</button>
              <Link to="/#chat" className="rounded-full border border-white/10 px-2 py-1 text-[10px] hover:border-primary/50 hover:text-primary">Abrir completo</Link>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2">
            <div className="flex flex-col gap-2">
              <textarea
                className="min-h-[160px] w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                placeholder={activeTab ? `Instrucciones para ${activeTab.path}…` : 'Escribe una instrucción breve…'}
                value={compactInput}
                onChange={(e) => setCompactInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    void sendCompact();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={includeFileContext}
                    onChange={(e) => setIncludeFileContext(e.target.checked)}
                  />
                  Usar archivo activo
                </label>
                <button
                  className="rounded-full border border-white/10 px-3 py-1 text-xs hover:border-primary/50 hover:text-primary disabled:opacity-50"
                  onClick={sendCompact}
                  disabled={compactSending || compactInput.trim().length === 0}
                >
                  {compactSending ? 'Enviando…' : 'Transmitir'}
                </button>
              </div>

              {(compactReply || compactError) && (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed">
                  {compactError ? (
                    <p className="text-destructive">{compactError}</p>
                  ) : (
                    <>
                      <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-muted-foreground">{compactReply}</pre>
                      {compactResult?.action === 'create-file' && compactResult.content && (
                        <div className="mt-2 flex items-center gap-2">
                          <a
                            href={`data:text/plain;charset=utf-8,${encodeURIComponent(compactResult.content)}`}
                            download={compactResult.path || 'archivo.txt'}
                            className="rounded-full border border-white/10 px-2 py-1 text-[11px] hover:border-primary/50 hover:text-primary"
                          >
                            Descargar
                          </a>
                          <button
                            className="rounded-full border border-white/10 px-2 py-1 text-[11px] hover:border-primary/50 hover:text-primary"
                            onClick={() => compactResult?.path && openFile(compactResult.path)}
                          >
                            Abrir
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Proceso IA (panel inferior a la derecha) */}
          <div className="border-t border-white/10 p-2">
            <p className="mb-2 text-xs uppercase tracking-[0.35em] text-muted-foreground">Proceso IA</p>
            <div className="max-h-32 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-2 text-[11px] leading-relaxed text-muted-foreground">
              {aiLog.length === 0 ? (
                <p className="opacity-60">Sin actividad aún</p>
              ) : (
                <ul className="space-y-1">
                  {aiLog.slice(-40).map((l, i) => (
                    <li key={i} className="whitespace-pre-wrap">{l}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}