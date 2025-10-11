import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Zap, Eye, Cpu, Shield, Globe2, Layers } from "lucide-react";

export default function XR() {
  const featureCards = [
    {
      title: "Accesos XR",
      description: "Entrada a módulos de realidad extendida y laboratorios virtuales.",
      icon: Eye,
      tone: "accent" as const,
    },
    {
      title: "Sensores",
      description: "Monitoreo espectral y análisis de integridad del enlace.",
      icon: Cpu,
      tone: "primary" as const,
    },
    {
      title: "Seguridad",
      description: "Protocolos de protección y aislamiento de entorno.",
      icon: Shield,
      tone: "destructive" as const,
    },
    {
      title: "Red",
      description: "Puentes de datos y sincronización con servicios externos.",
      icon: Globe2,
      tone: "accent" as const,
    },
    {
      title: "Capas",
      description: "Estructuras de escena y distribución de contenidos XR.",
      icon: Layers,
      tone: "primary" as const,
    },
  ];

  return (
    <main className="relative mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl text-accent">Módulo XR</h1>
        <Link
          to="/"
          className="rounded-full border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.45em] text-muted-foreground transition hover:border-primary/60 hover:text-primary"
        >
          Volver al núcleo
        </Link>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="rounded-3xl border border-white/10 bg-black/30 p-8 shadow-neon"
      >
        <div className="flex items-center gap-3">
          <Zap className="size-5 text-accent" />
          <h2 className="font-display text-2xl">Protocolos activos</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Accede a los espacios XR dedicados. Este módulo opera de forma independiente y no usa zonas ocultas.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((card) => (
            <div key={card.title} className="rounded-2xl border border-white/10 bg-black/40 p-6">
              <div className="flex items-center gap-3">
                <card.icon className="size-5 text-accent" />
                <h3 className="font-display text-lg">{card.title}</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{card.description}</p>
            </div>
          ))}
        </div>
      </motion.section>
    </main>
  );
}