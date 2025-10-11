import { useState, useEffect } from "react";
import {
  Code,
  FileText,
  Terminal,
  Settings,
  Wrench,
  Folder,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BuilderTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: string;
}

interface FileTemplate {
  id: string;
  name: string;
  extension: string;
  template: string;
  icon: string;
}

interface BuilderModeProps {
  onCommandGenerated: (command: string) => void;
  className?: string;
}

// Configurable por .env (Vite): VITE_BUILDER_API_BASE
const BUILDER_API_BASE = (import.meta.env.VITE_BUILDER_API_BASE as string | undefined) ?? "";

export function BuilderMode({ onCommandGenerated, className }: BuilderModeProps) {
  const [templates, setTemplates] = useState<BuilderTemplate[]>([]);
  const [fileTemplates, setFileTemplates] = useState<FileTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean>(false);

  // Templates predefinidos como fallback
  const defaultTemplates: BuilderTemplate[] = [
    {
      id: "react-app",
      name: "React App",
      description: "Aplicación React con Vite",
      icon: "Code",
      type: "react"
    },
    {
      id: "nextjs-app", 
      name: "Next.js",
      description: "Aplicación Next.js con TypeScript",
      icon: "Code",
      type: "nextjs"
    },
    {
      id: "vue-app",
      name: "Vue App",
      description: "Aplicación Vue.js 3",
      icon: "Code", 
      type: "vue"
    },
    {
      id: "python-api",
      name: "Python API",
      description: "API REST con Flask/FastAPI",
      icon: "Terminal",
      type: "python-api"
    },
    {
      id: "express-app",
      name: "Express API",
      description: "API Node.js con Express",
      icon: "Terminal",
      type: "express"
    },
    {
      id: "html-static",
      name: "HTML Static",
      description: "Sitio web estático",
      icon: "FileText",
      type: "html"
    }
  ];

  const defaultFileTemplates: FileTemplate[] = [
    {
      id: "component",
      name: "Component",
      extension: ".tsx",
      template: "react-component",
      icon: "Code"
    },
    {
      id: "api",
      name: "API Route",
      extension: ".ts",
      template: "api-route",
      icon: "Terminal"
    },
    {
      id: "config",
      name: "Config",
      extension: ".json",
      template: "config-file",
      icon: "Settings"
    },
    {
      id: "style",
      name: "CSS",
      extension: ".css",
      template: "stylesheet",
      icon: "FileText"
    },
    {
      id: "test",
      name: "Test",
      extension: ".test.ts",
      template: "test-file",
      icon: "Wrench"
    },
    {
      id: "docs",
      name: "Docs",
      extension: ".md",
      template: "documentation",
      icon: "FileText"
    }
  ];

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Si no hay API configurada, usar templates locales sin advertencia
      if (!BUILDER_API_BASE) {
        setTemplates(defaultTemplates);
        setFileTemplates(defaultFileTemplates);
        setApiAvailable(false);
        return;
      }

      // Intentar obtener templates de la API Python
      const response = await fetch(`${BUILDER_API_BASE}/templates`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || defaultTemplates);
        setFileTemplates(data.fileTemplates || defaultFileTemplates);
        setApiAvailable(true);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      console.warn("No se pudo conectar con la API del builder mode, usando templates por defecto:", err);
      setTemplates(defaultTemplates);
      setFileTemplates(defaultFileTemplates);
      setApiAvailable(false);
      // Mostrar advertencia solo si la API está configurada pero no disponible
      if (BUILDER_API_BASE) {
        setError("Usando templates locales (API no disponible)");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuilderCommand = async (template: BuilderTemplate) => {
    const projectName = prompt(`Nombre del proyecto ${template.name}:`);
    if (projectName) {
      try {
        if (BUILDER_API_BASE) {
          // Intentar usar la API Python para scaffolding
          const response = await fetch(`${BUILDER_API_BASE}/scaffold`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              template: template.type,
              name: projectName,
              path: `./${projectName}`
            }),
          });

          if (response.ok) {
            const result = await response.json();
            onCommandGenerated(`Proyecto ${template.name} "${projectName}" creado exitosamente: ${result.message}`);
            return;
          } else {
            throw new Error(`HTTP ${response.status}`);
          }
        }
      } catch (err) {
        // Fallback a comando de texto
        console.warn("Error en API, usando comando de texto:", err);
        onCommandGenerated(`Crear proyecto ${template.name} llamado "${projectName}" usando ${template.type}`);
        return;
      }
      // Si no hay API configurada, usar fallback directo
      onCommandGenerated(`Crear proyecto ${template.name} llamado "${projectName}" usando ${template.type}`);
    }
  };

  const handleFileCreation = (fileTemplate: FileTemplate) => {
    const fileName = prompt(`Nombre del archivo ${fileTemplate.name}:`);
    if (fileName) {
      const fullFileName = fileName.includes('.') ? fileName : `${fileName}${fileTemplate.extension}`;
      onCommandGenerated(`Crear archivo ${fileTemplate.name}: ${fullFileName} usando template ${fileTemplate.template}`);
    }
  };

  const getIcon = (iconName: string) => {
    const icons = {
      Code,
      FileText,
      Terminal,
      Settings,
      Wrench,
      Folder,
    };
    const IconComponent = icons[iconName as keyof typeof icons] || Code;
    return IconComponent;
  };

  if (isLoading) {
    return (
      <div className={cn("flex flex-col gap-2 sm:w-80", className)}>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Cargando templates...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2 sm:w-80", className)}>
      {error && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-2">
          <div className="flex items-center gap-2 text-xs text-yellow-400">
            <AlertTriangle className="size-3" />
            {error}
          </div>
        </div>
      )}

      {/* Builder Mode Panel */}
      <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
        <p className="mb-3 text-xs uppercase tracking-[0.5em] text-primary">Builder Mode</p>
        <div className="grid grid-cols-2 gap-2">
          {templates.slice(0, 4).map((template, index) => {
            const IconComponent = getIcon(template.icon);
            return (
              <button
                key={`builder-${template.id}-${index}`}
                type="button"
                onClick={() => handleBuilderCommand(template)}
                className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-black/40 p-3 text-xs transition hover:border-primary/50 hover:bg-primary/10"
                title={template.description}
              >
                <IconComponent className="size-4 text-primary" />
                <span>{template.name}</span>
              </button>
            );
          })}
        </div>
        
        {templates.length > 4 && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {templates.slice(4).map((template, index) => {
              const IconComponent = getIcon(template.icon);
              return (
                <button
                  key={`builder-extra-${template.id}-${index}`}
                  type="button"
                  onClick={() => handleBuilderCommand(template)}
                  className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-black/40 p-3 text-xs transition hover:border-primary/50 hover:bg-primary/10"
                  title={template.description}
                >
                  <IconComponent className="size-4 text-primary" />
                  <span>{template.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* File Creation Panel */}
      <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
        <p className="mb-3 text-xs uppercase tracking-[0.5em] text-primary">Crear Archivos</p>
        <div className="grid grid-cols-3 gap-2">
          {fileTemplates.map((fileTemplate, index) => {
            const IconComponent = getIcon(fileTemplate.icon);
            return (
              <button
                key={`file-${fileTemplate.id}-${index}`}
                type="button"
                onClick={() => handleFileCreation(fileTemplate)}
                className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-black/40 p-2 text-xs transition hover:border-primary/50 hover:bg-primary/10"
                title={`Crear ${fileTemplate.name}${fileTemplate.extension}`}
              >
                <IconComponent className="size-3 text-primary" />
                <span>{fileTemplate.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Indicador de estado */}
      <div className="rounded-xl border border-white/10 bg-black/30 p-2">
        <div className="flex items-center gap-2 text-xs">
          <CheckCircle2 className="size-3 text-green-400" />
          <span className="text-muted-foreground">Modo Builder {apiAvailable ? "Conectado" : "Local"}</span>
        </div>
      </div>
    </div>
  );
}