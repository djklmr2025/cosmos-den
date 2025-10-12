export type FsItem = { name: string; path: string; type: "file" | "dir" };

export async function apiFsList(pathRel: string = ".") {
  const res = await fetch("/fs/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: pathRel }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Error list");
  return data.items as FsItem[];
}

export async function apiFsRead(pathRel: string) {
  const res = await fetch("/fs/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: pathRel }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Error read");
  return data.content as string;
}

export async function apiFsWrite(pathRel: string, content: string) {
  const res = await fetch("/fs/write", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: pathRel, content }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Error write");
  return true;
}

export async function apiFsAppend(pathRel: string, content: string) {
  const res = await fetch("/fs/append", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: pathRel, content, ensureNewline: true }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Error append");
  return true;
}

export async function apiFsMkdir(pathRel: string) {
  const res = await fetch("/fs/mkdir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: pathRel }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Error mkdir");
  return true;
}