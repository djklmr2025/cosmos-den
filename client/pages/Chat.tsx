import React, { useState, useRef, useEffect } from 'react';
// Importamos componentes de tu librería UI para mantener la consistencia visual
import { Button } from '@/components/ui/button'; 
import { Input } from '@/components/ui/input'; 
import MediaGenerator from '@/components/MediaGenerator';

// Definición de tipos para los mensajes
interface Message {
  text: string;
  sender: 'user' | 'ai';
  media?: {
    type: 'image' | 'video';
    url: string;
    downloadUrl?: string;
    provider?: string;
  };
}

/**
 * Componente principal de la interfaz de chat con A.I.D.A.
 * Muestra el historial y maneja el envío de mensajes a la API de Express.
 */
const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Referencia para desplazar automáticamente al final del chat
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Efecto para hacer scroll al final cada vez que se añaden mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Escucha resultados de generación de medios para renderizar en el chat
  useEffect(() => {
    const handler = (ev: Event) => {
      try {
        const d = (ev as CustomEvent<{ type: 'image' | 'video'; provider?: string; url: string; downloadUrl?: string; prompt?: string }>).detail;
        if (!d || !d.url) return;
        const label = d.type === 'video' ? '🎬 Tu video está listo' : '🖼️ Tu imagen está lista';
        const text = `${label}${d.provider ? ` (proveedor: ${d.provider})` : ''}.`;
        setMessages(prev => [...prev, { text, sender: 'ai', media: { type: d.type, url: d.url, downloadUrl: d.downloadUrl, provider: d.provider } }]);
      } catch (err) {
        console.warn('Evento arkaios.media.result inválido:', err);
      }
    };
    window.addEventListener('arkaios.media.result', handler as EventListener);
    return () => {
      window.removeEventListener('arkaios.media.result', handler as EventListener);
    };
  }, []);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    // 1. Añadir mensaje del usuario
    setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
    setInput('');
    setIsLoading(true);
    
    // 2. Añadir mensaje de "procesando" temporalmente
    const processingMsg: Message = { text: '🔎 Arkaios está procesando...', sender: 'ai' };
    let temporaryIndex: number;
    setMessages(prev => {
        temporaryIndex = prev.length + 1;
        return [...prev, processingMsg];
    });

    // 2.1 Detección simple de intención de generación de medios
    const lower = userMessage.toLowerCase();
    const wantsImage = [
      'crear una imagen',
      'crear imagen',
      'genera una imagen',
      'generar una imagen',
      'dibuja',
      'haz una imagen',
      'imagen de',
      'ilustración',
    ].some((p) => lower.includes(p));
    const wantsVideo = [
      'crear un video',
      'crear video',
      'genera un video',
      'generar un video',
      'animación',
      'clip de',
    ].some((p) => lower.includes(p));

    if (wantsImage || wantsVideo) {
      // Reemplazar mensaje de procesamiento con confirmación de enrutamiento
      setMessages(prev => prev.map((msg, index) => 
        index === temporaryIndex
          ? { ...msg, text: `🎨 Detecté intención de ${wantsImage ? 'imagen' : 'video'}. Activando el módulo "Generar medios" con tu prompt.` }
          : msg
      ));

      // Enviar evento al panel de generación de medios para autocompletar y ejecutar
      try {
        const detail = {
          prompt: userMessage,
          type: wantsImage ? 'image' as const : 'video' as const,
          // Usamos proveedor libre por defecto para imagen; video usa Luma si está configurado
          provider: wantsImage ? 'pollinations' : 'luma',
          auto: true,
        };
        window.dispatchEvent(new CustomEvent('arkaios.media.prompt', { detail }));
      } catch (err) {
        console.error('No se pudo despachar evento de media:', err);
      }

      setIsLoading(false);
      return; // No llamar al núcleo de chat para estos casos
    }

    try {
      // 3. Llama a la ruta de Express que hemos creado (/api/chat)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMessage })
      });

      if (!response.ok) throw new Error("Server/Gateway error");
      
      const data = await response.json();
      
      // Obtiene el texto de respuesta (puede ser data.output o el objeto completo)
      const aiResponseText = data.output || JSON.stringify(data, null, 2);

      // 4. Reemplaza el mensaje de "procesando" por la respuesta real de la IA
      setMessages(prev => prev.map((msg, index) => 
        index === temporaryIndex ? { ...msg, text: aiResponseText } : msg
      ));
      
    } catch (error) {
      console.error("Chat Error:", error);
      // 5. Muestra un mensaje de error si la comunicación falla
      setMessages(prev => prev.map((msg, index) => 
        index === temporaryIndex ? { ...msg, text: "Error: Falló la comunicación con el núcleo de A.I.D.A." } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[85vh] max-w-3xl mx-auto p-6 bg-gray-900 rounded-2xl shadow-2xl border border-teal-500/50">
      <h1 className="text-3xl font-extrabold text-teal-400 mb-6 border-b border-teal-700 pb-2 text-center">
        Núcleo de Chat Arkaios (A.I.D.A.)
      </h1>
      <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-gray-950 rounded-lg custom-scrollbar">
        {messages.length === 0 && (
          <p className="text-gray-400 text-center mt-20 italic">
            Escribe tu primer mensaje. Estoy listo para ayudarte a mapear BuilderOS.
          </p>
        )}
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`max-w-[85%] p-3 rounded-xl shadow-lg transition-all duration-300 ${
              msg.sender === 'user' 
                ? 'ml-auto bg-blue-700 text-white' 
                : 'mr-auto bg-gray-700 text-gray-100 border border-teal-500/30'
            }`}
          >
            <div className="mb-2 whitespace-pre-wrap">{msg.text}</div>
            {msg.media?.type === 'video' && (
              <div className="mt-2">
                <video src={msg.media.url} controls className="w-full rounded border border-teal-700" />
                {msg.media.downloadUrl && (
                  <div className="mt-2">
                    <a
                      href={msg.media.downloadUrl}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center px-3 py-2 rounded bg-teal-500 text-gray-900 hover:bg-teal-400"
                    >
                      Descargar video
                    </a>
                  </div>
                )}
              </div>
            )}
            {msg.media?.type === 'image' && (
              <div className="mt-2">
                <img src={msg.media.url} className="max-w-full rounded border border-teal-700" />
                {msg.media.downloadUrl && (
                  <div className="mt-2">
                    <a
                      href={msg.media.downloadUrl}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center px-3 py-2 rounded bg-teal-500 text-gray-900 hover:bg-teal-400"
                    >
                      Descargar imagen
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {/* Elemento vacío para hacer scroll */}
        <div ref={messagesEndRef} />
      </div>
      {/* Panel de generación de medios (Imagen/Video) */}
      <MediaGenerator />
      <form onSubmit={sendMessage} className="flex mt-6">
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isLoading ? "Esperando respuesta de A.I.D.A...." : "Escribe tu mensaje aquí..."}
          disabled={isLoading}
          className="flex-1 p-3 rounded-l-lg bg-gray-800 text-white border-r-0 border-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
        />
        <Button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="p-3 rounded-r-lg bg-teal-500 hover:bg-teal-600 text-gray-900 font-bold disabled:bg-gray-500 disabled:text-gray-200"
        >
          {isLoading ? '...' : 'Enviar'}
        </Button>
      </form>
    </div>
  );
};

export default Chat;
