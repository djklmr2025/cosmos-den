// Usamos import * as express para obtener el módulo completo (CommonJS-friendly)
import * as express from "express"; 

// SOLUCIÓN: Usamos 'import type' para indicar que solo queremos las interfaces/tipos
import type { Request, Response, Router } from "express"; 

// Creamos una instancia de Router usando la importación completa de express
const apiRouter = express.Router(); 

// Ruta de prueba: /api/ping
apiRouter.get("/ping", (req: Request, res: Response) => {
  const message = process.env.PING_MESSAGE || "pong";
  res.json({ message: message });
});

// Ruta de prueba: /api/demo
apiRouter.get("/demo", (req: Request, res: Response) => {
  res.json({ data: "Demo data from server" });
});

export default apiRouter;