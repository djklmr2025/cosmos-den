// Health-check for Vercel deployments that may have Deployment Protection enabled.
// Usage:
//   VERCEL_DOMAIN=your-app.vercel.app \
//   VERCEL_BYPASS_TOKEN=xxxxxxxx \
//   HEALTH_PATH=/api/health \
//   node scripts/vercel-health-check.mjs

const domain = process.env.VERCEL_DOMAIN;
const bypassToken = process.env.VERCEL_BYPASS_TOKEN;
const optionalBypass = process.env.BYPASS_OPTIONAL === "1" || process.env.BYPASS_OPTIONAL === "true";
const healthPath = process.env.HEALTH_PATH || "/api/health";

if (!domain) {
  console.error("[health-check] Missing env VERCEL_DOMAIN (e.g., my-app.vercel.app)");
  process.exit(2);
}

if (!bypassToken && !optionalBypass) {
  console.error("[health-check] Missing env VERCEL_BYPASS_TOKEN (set BYPASS_OPTIONAL=1 to skip)");
  process.exit(2);
}

const endpoints = [
  `https://${domain}/`,
  `https://${domain}${healthPath.startsWith("/") ? healthPath : `/${healthPath}`}`,
];

async function check(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const headers = bypassToken ? { "x-vercel-protection-bypass": bypassToken } : {};
    const res = await fetch(url, {
      headers,
      redirect: "follow",
      signal: controller.signal,
    });
    const ok = res.status === 200;
    const statusInfo = `${res.status}${res.statusText ? ` ${res.statusText}` : ""}`;
    let preview = "";
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        const data = await res.json();
        preview = ` json=${JSON.stringify(data).slice(0, 200)}`;
      } catch {}
    } else {
      try {
        const text = await res.text();
        preview = ` body=${text.replace(/\s+/g, " ").slice(0, 200)}`;
      } catch {}
    }
    console.log(`[health-check] ${ok ? "PASS" : "FAIL"} ${url} -> ${statusInfo}${preview}`);
    return ok;
  } catch (err) {
    console.error(`[health-check] ERROR ${url} -> ${err?.message || err}`);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const results = [];
  for (const url of endpoints) {
    // Retry once if the first attempt fails (temporary flakiness or cold start)
    const first = await check(url);
    if (!first) {
      await new Promise((r) => setTimeout(r, 1000));
      const second = await check(url);
      results.push(first || second);
    } else {
      results.push(true);
    }
  }
  const allOk = results.every(Boolean);
  if (!allOk) {
    console.error("[health-check] One or more endpoints failed.");
    process.exit(1);
  }
  console.log("[health-check] All endpoints healthy.");
}

main();