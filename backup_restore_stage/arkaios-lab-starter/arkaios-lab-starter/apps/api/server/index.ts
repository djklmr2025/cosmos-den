import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleAiChat } from "./routes/ai-chat.js";
dotenv.config();

export function createServer(){
  const app = express(); const PORT = process.env.PORT || 8080;
  app.use(cors()); app.use(express.json()); app.use(express.urlencoded({extended:true}));
  app.get("/ping",(_req,res)=>res.send(process.env.PING_MESSAGE||"pong"));
  app.get("/health",(_req,res)=>res.json({status:"ok", time:new Date().toISOString()}));
  app.get("/health/deep", async (_req,res)=>{
    try{ const r= await fetch(process.env.AIDA_GATEWAY_URL!,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.AIDA_AUTH_TOKEN}`},body:JSON.stringify({agent_id:"puter",action:"ask",params:{objective:"status ping"}})});
      const ok=r.ok; const body= ok? await r.json(): await r.text(); res.status(ok?200:502).json({status: ok?"ok":"bad_gateway", sample: ok? (body.output??body.result??body): body});
    }catch(e:any){ res.status(500).json({status:"error", error:e?.message??String(e)}); }
  });
  app.post("/api/chat", handleAiChat);
  const __filename = fileURLToPath(import.meta.url); const __dirname = path.dirname(__filename);
  if (process.env.SERVE_STATIC==="true"){ const spaDir= path.resolve(__dirname, "../../../ui/dist"); app.use(express.static(spaDir)); app.get("*",(_req,res)=>res.sendFile(path.join(spaDir,"index.html"))); }
  app.listen(PORT, ()=>{ console.log(`🚀 API http://localhost:${PORT}`); if (process.env.SERVE_STATIC==="true") console.log("🔗 SPA estática activada"); });
  return app;
}
if (import.meta.main) createServer();
