import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import XR from "./pages/XR";
import NotFound from "./pages/NotFound";
import Workbench from "./pages/Workbench";
import Lab from "./pages/Lab";
import Todo from "./pages/Todo";
import GatewayPage from "./pages/Gateway";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/workbench" element={<Workbench />} />
          <Route path="/xr" element={<XR />} />
          <Route path="/lab" element={<Lab />} />
          <Route path="/gateway" element={<GatewayPage />} />
          <Route path="/todo" element={<Todo />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
