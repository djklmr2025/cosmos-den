import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Radar } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid-glow [background-size:36px_36px] opacity-20" />
        <div className="absolute left-1/2 top-16 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-primary/25 blur-[120px]" />
      </div>
      <div className="relative z-10 mx-6 max-w-xl rounded-[36px] border border-primary/40 bg-black/50 p-12 text-center shadow-neon backdrop-blur-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/60 bg-primary/15 text-primary">
          <Radar className="size-8" />
        </div>
        <h1 className="mt-8 font-display text-5xl uppercase tracking-[0.45em] text-primary">
          404
        </h1>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          El nodo <span className="text-primary">{location.pathname}</span> no
          forma parte del plano de navegación de ARKAIOS. Recalibra y vuelve al
          núcleo para restaurar la sincronía.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            to="/"
            className="group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-full border border-primary/60 px-6 text-xs font-semibold uppercase tracking-[0.48em] text-primary"
          >
            <span className="absolute inset-0 bg-primary/15 transition duration-300 group-hover:bg-primary/35" />
            <ArrowLeft className="relative z-10 size-4" />
            <span className="relative z-10">Volver al núcleo</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
