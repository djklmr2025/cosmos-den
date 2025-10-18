export type Parsed = {
  ok: boolean;
  status: number;
  data: any;
  raw: string;
  contentType: string;
};

export async function safeParse(res: Response): Promise<Parsed> {
  const contentType = res.headers.get('content-type') || '';
  const raw = await res.text();
  let data: any = null;

  if (contentType.includes('application/json') && raw.trim().length > 0) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }
  } else {
    data = { raw };
  }

  return { ok: res.ok, status: res.status, data, raw, contentType };
}

export async function request(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  const parsed = await safeParse(res);
  if (!parsed.ok) {
    const msg = parsed.data?.error || parsed.raw || `HTTP ${parsed.status}`;
    throw new Error(msg);
  }
  return parsed.data;
}

export function jsonPost(body: any): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  };
}