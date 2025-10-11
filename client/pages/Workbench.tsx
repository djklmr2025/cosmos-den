import { useEffect, useMemo, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import Editor from "@monaco-editor/react";
import { apiFsList, apiFsRead, apiFsWrite, apiFsMkdir, type FsItem } from "@/lib/fs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function extToLang(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "css":
      return "css";
    case "html":
      return "html";
    case "md":
      return "markdown";
    default:
      return "plaintext";
  }
}

export default function Workbench() {
  const [cwd, setCwd] = useState<string>(".");
  const [items, setItems] = useState<FsItem[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const lang = useMemo(() => (selected ? extToLang(selected) : "plaintext"), [selected]);
  const [newDir, setNewDir] = useState("");
  const [termCmd, setTermCmd] = useState("node");
  const [termArgs, setTermArgs] = useState<string>("-v");
  const [termOutput, setTermOutput] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const list = await apiFsList(cwd);
        setItems(list);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [cwd]);

  async function openItem(it: FsItem) {
    if (it.type === "dir") {
      setCwd(it.path);
      setSelected("");
      setContent("");
    } else {
      try {
        const c = await apiFsRead(it.path);
        setSelected(it.path);
        setContent(c);
      } catch (e) {
        console.error(e);
      }
    }
  }

  async function save() {
    if (!selected) return;
    try {
      await apiFsWrite(selected, content);
    } catch (e) {
      console.error(e);
    }
  }

  async function runTerminal() {
    setTermOutput("Ejecutando...\n");
    try {
      const res = await fetch("/api/terminal/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd: termCmd, args: termArgs.split(" ").filter(Boolean) }),
      });
      const data = await res.json();
      if (!data.ok) {
        setTermOutput(`Error: ${data.error || ""}`);
      } else {
        setTermOutput(data.output || "(sin salida)");
      }
    } catch (e: any) {
      setTermOutput(`Error: ${e.message || e}`);
    }
  }

  return (
    <div className="h-screen w-screen overflow-hidden">
      <Tabs defaultValue="workbench" className="h-full w-full">
        <TabsList className="p-2">
          <TabsTrigger value="workbench">Workbench</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
        </TabsList>
        <TabsContent value="workbench" className="h-[calc(100%-48px)] w-full">
          <PanelGroup direction="horizontal" className="h-full">
            <Panel defaultSize={25} minSize={15} className="border-r">
              <div className="p-2 flex gap-2 items-center border-b">
                <Button variant="secondary" onClick={() => setCwd(pathUp(cwd))}>Arriba</Button>
                <Input placeholder="Nueva carpeta" value={newDir} onChange={(e) => setNewDir(e.target.value)} />
                <Button onClick={async () => { if (newDir) { try { await apiFsMkdir(`${cwd}/${newDir}`); setNewDir(""); setItems(await apiFsList(cwd)); } catch (e) { console.error(e); } } }}>Crear</Button>
              </div>
              <div className="p-2">
                <ul className="space-y-1">
                  {items.map((it) => (
                    <li key={it.path}>
                      <button className="w-full text-left hover:bg-muted p-1 rounded" onClick={() => openItem(it)}>
                        <span className="mr-2">{it.type === "dir" ? "📁" : "📄"}</span>
                        {it.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
            <PanelResizeHandle className="w-1 bg-border" />
            <Panel minSize={25}>
              <div className="h-full flex flex-col">
                <div className="border-b p-2 text-sm flex items-center gap-2">
                  <span className="font-medium">{selected || "Sin archivo"}</span>
                  <Button size="sm" onClick={save} disabled={!selected}>Guardar</Button>
                </div>
                <div className="flex-1">
                  <Editor
                    height="100%"
                    theme="vs-dark"
                    language={lang}
                    value={content}
                    onChange={(v) => setContent(v || "")}
                    options={{ fontSize: 14, minimap: { enabled: false } }}
                  />
                </div>
                <div className="border-t p-2 space-y-2 bg-background">
                  <div className="text-sm font-medium">Terminal</div>
                  <div className="flex gap-2">
                    <Input className="w-32" placeholder="cmd" value={termCmd} onChange={(e) => setTermCmd(e.target.value)} />
                    <Input placeholder="args" value={termArgs} onChange={(e) => setTermArgs(e.target.value)} />
                    <Button variant="secondary" onClick={runTerminal}>Run</Button>
                  </div>
                  <pre className="bg-muted p-2 rounded text-xs whitespace-pre-wrap h-32 overflow-auto">{termOutput}</pre>
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </TabsContent>
        <TabsContent value="chat" className="p-4">
          <ChatPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function pathUp(p: string) {
  if (!p || p === ".") return ".";
  const parts = p.split("/").filter(Boolean);
  parts.pop();
  return parts.length ? parts.join("/") : ".";
}

function ChatPanel() {
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState("");
  async function send() {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    setReply(data.reply || data.error || "");
  }
  return (
    <div className="max-w-2xl space-y-2">
      <Input placeholder="Escribe tu prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <Button onClick={send}>Enviar</Button>
      <pre className="bg-muted p-2 rounded text-sm whitespace-pre-wrap">{reply}</pre>
    </div>
  );
}