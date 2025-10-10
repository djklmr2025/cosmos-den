// src/utils/file-tools.ts
export function createBlobURL(text: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  return URL.createObjectURL(blob);
}

export function createDownloadLink(filename: string, text: string, mime = "text/plain;charset=utf-8") {
  const url = createBlobURL(text, mime);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.target = "_blank";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return url;
}

export async function saveToPuterFS(path: string, text: string, mime = "text/plain;charset=utf-8") {
  const g: any = globalThis as any;
  if (!g.puter || !g.puter.fs || !g.puter.fs.writeFile) return { ok: false, reason: "no_puter_fs" };
  try {
    await g.puter.fs.writeFile(path, text, { mimeType: mime });
    let publicURL: string | null = null;
    if (g.puter.fs.getPublicURL) publicURL = await g.puter.fs.getPublicURL(path);
    return { ok: true, path, publicURL };
  } catch (e: any) {
    return { ok: false, reason: e?.message || String(e) };
  }
}

export function printText(text: string, title = "Documento") {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:ui-sans-serif,system-ui,Arial;padding:24px;white-space:pre-wrap}</style></head>
  <body>${text.replace(/</g,"&lt;")}</body></html>`;
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  return true;
}
