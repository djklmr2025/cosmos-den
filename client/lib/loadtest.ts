export type LoadTestResult = {
  startedAt: number;
  health?: any;
  fsListLatencyMs?: number[];
  fsReadLatencyMs?: number[];
  wsOk?: boolean;
  errors: string[];
};

async function time<T>(fn: () => Promise<T>): Promise<{ ms: number; value?: T; error?: any }>{
  const t0 = performance.now();
  try {
    const value = await fn();
    const t1 = performance.now();
    return { ms: Math.round(t1 - t0), value };
  } catch (error) {
    const t1 = performance.now();
    return { ms: Math.round(t1 - t0), error };
  }
}

export async function runMiniLoadTest(): Promise<LoadTestResult> {
  const result: LoadTestResult = { startedAt: Date.now(), errors: [] };
  try {
    // Health check
    const healthRes = await fetch('/api/health');
    result.health = await healthRes.json();
  } catch (e: any) {
    result.errors.push(`health: ${e?.message || String(e)}`);
  }

  // Parallel /fs/list x5
  const listPromises = Array.from({ length: 5 }, () => time(() => fetch('/fs/list', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '.' })
  }).then(r => r.json())));
  const listResults = await Promise.all(listPromises);
  result.fsListLatencyMs = listResults.map(r => r.ms);
  listResults.forEach((r) => { if (r.error || !r.value?.ok) result.errors.push(`fs/list: ${r.error?.message || r.value?.error || 'unknown'}`); });

  // If archivo.txt exists, read it 3 times
  const readPromises = Array.from({ length: 3 }, () => time(() => fetch('/fs/read', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: 'archivo.txt' })
  }).then(r => r.json())));
  const readResults = await Promise.all(readPromises);
  result.fsReadLatencyMs = readResults.map(r => r.ms);
  readResults.forEach((r) => { if (r.error || !r.value?.ok) result.errors.push(`fs/read: ${r.error?.message || r.value?.error || 'unknown'}`); });

  // WS terminal ping
  try {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/terminal?shell=powershell`);
      let ok = false;
      ws.onopen = () => { try { ws.send('echo ARKAIOS\r\n'); } catch {} };
      ws.onmessage = (evt) => {
        if (String(evt.data).toLowerCase().includes('arkaios')) { ok = true; try { ws.close(); } catch {} }
      };
      ws.onerror = (err) => { reject(err); };
      ws.onclose = () => { ok ? resolve() : reject(new Error('ws no respondió')); };
    });
    result.wsOk = true;
  } catch (e: any) {
    result.wsOk = false;
    result.errors.push(`ws: ${e?.message || String(e)}`);
  }

  return result;
}