import "./global.css";
import "sonner/dist/styles.css";

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

const queryClient = new QueryClient();

function DebugBanner() {
  const [message, setMessage] = (window as any).__debugBannerState ||
    ((window as any).__debugBannerState = (() => {
      const state = { listeners: [] as ((msg: string) => void)[], msg: "App montada" };
      return [
        {
          get current() {
            return state.msg;
          },
          set current(v: string) {
            state.msg = v;
            state.listeners.forEach((fn) => fn(v));
          },
          subscribe(fn: (msg: string) => void) {
            state.listeners.push(fn);
            return () => {
              state.listeners = state.listeners.filter((f) => f !== fn);
            };
          },
        },
      ];
    })());

  const [text, setText] = ((): [string, (v: string) => void] => {
    const store = (message as any)[0];
    const set = (v: string) => (store.current = v);
    const [initial] = [store.current];
    store.subscribe((v: string) => setText(v));
    return [initial, set];
  })();

  // Expose helpers
  (window as any).__setDebugMessage = setText;

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        left: 8,
        zIndex: 9999,
        padding: "6px 10px",
        borderRadius: 8,
        background: "rgba(20,20,20,0.85)",
        color: "#2DFFE6",
        fontFamily: "system-ui, monospace",
        fontSize: 12,
        border: "1px solid #2DFFE6",
        boxShadow: "0 0 12px rgba(45,255,230,0.4)",
      }}
    >
      DEBUG: {text}
    </div>
  );
}

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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
