/**
 * ARKAIOS Voice Module
 * Implementa funcionalidades de Text-to-Speech y Speech-to-Text
 * utilizando la Web Speech API
 */

class ArkaiosVoice {
  constructor() {
    // Inicializar propiedades
    this.synthesis = window.speechSynthesis;
    this.recognition = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.voices = [];
    this.selectedVoice = null;
    this.language = 'es-ES';
    this.rate = 1.0;
    this.pitch = 1.0;
    this.volume = 1.0;
    
    // Elementos de la UI
    this.btnListen = document.getElementById('voice-listen');
    this.btnSpeak = document.getElementById('voice-speak');
    this.langSelect = document.getElementById('voice-language');
    this.speedSelect = document.getElementById('voice-speed');
    this.statusElement = document.getElementById('voice-status');
    
    // Inicializar
    this.init();
  }
  
  init() {
    // Cargar voces disponibles
    this.loadVoices();
    
    // Configurar reconocimiento de voz si está disponible
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = this.language;
      
      // Configurar eventos de reconocimiento
      this.setupRecognitionEvents();
      this.btnListen.disabled = false;
    } else {
      console.warn('El reconocimiento de voz no está soportado en este navegador');
      this.btnListen.disabled = true;
      this.btnListen.title = 'Reconocimiento de voz no soportado';
    }
    
    // Configurar síntesis de voz
    if (this.synthesis) {
      this.btnSpeak.disabled = false;
    } else {
      console.warn('La síntesis de voz no está soportada en este navegador');
      this.btnSpeak.disabled = true;
      this.btnSpeak.title = 'Síntesis de voz no soportada';
    }
    
    // Configurar eventos de UI
    this.setupUIEvents();
  }
  
  loadVoices() {
    // Cargar voces disponibles
    if (this.synthesis) {
      // Algunas veces las voces se cargan de forma asíncrona
      this.voices = this.synthesis.getVoices();
      
      if (this.voices.length === 0) {
        this.synthesis.onvoiceschanged = () => {
          this.voices = this.synthesis.getVoices();
          this.selectVoiceForLanguage(this.language);
        };
      } else {
        this.selectVoiceForLanguage(this.language);
      }
    }
  }
  
  selectVoiceForLanguage(language) {
    // Seleccionar voz para el idioma actual
    this.selectedVoice = this.voices.find(voice => voice.lang.startsWith(language));
    
    // Si no hay voz para el idioma, usar la primera disponible
    if (!this.selectedVoice && this.voices.length > 0) {
      this.selectedVoice = this.voices[0];
    }
  }
  
  setupRecognitionEvents() {
    if (!this.recognition) return;
    
    // Evento cuando se detecta un resultado
    this.recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      
      if (event.results[0].isFinal) {
        // Insertar texto reconocido en el campo de texto
        const textArea = document.getElementById('text');
        textArea.value = transcript;
        this.updateStatus('Reconocimiento completado');
      }
    };
    
    // Evento cuando termina el reconocimiento
    this.recognition.onend = () => {
      this.isListening = false;
      this.btnListen.classList.remove('active');
      this.updateStatus('Reconocimiento detenido');
    };
    
    // Evento de error
    this.recognition.onerror = (event) => {
      console.error('Error en reconocimiento de voz:', event.error);
      this.updateStatus(`Error: ${event.error}`);
      this.isListening = false;
      this.btnListen.classList.remove('active');
    };
  }
  
  setupUIEvents() {
    // Botón de escuchar
    this.btnListen.addEventListener('click', () => {
      if (this.isListening) {
        this.stopListening();
      } else {
        this.startListening();
      }
    });
    
    // Botón de hablar
    this.btnSpeak.addEventListener('click', () => {
      const lastMessage = this.getLastAIMessage();
      if (lastMessage) {
        if (this.isSpeaking) {
          this.stopSpeaking();
        } else {
          this.speak(lastMessage);
        }
      } else {
        this.updateStatus('No hay mensaje para leer');
      }
    });
    
    // Selector de idioma
    this.langSelect.addEventListener('change', (e) => {
      this.language = e.target.value;
      if (this.recognition) {
        this.recognition.lang = this.language;
      }
      this.selectVoiceForLanguage(this.language);
    });
    
    // Selector de velocidad
    this.speedSelect.addEventListener('change', (e) => {
      this.rate = parseFloat(e.target.value);
    });
  }
  
  startListening() {
    if (!this.recognition || this.isListening) return;
    
    try {
      this.recognition.start();
      this.isListening = true;
      this.btnListen.classList.add('active');
      this.updateStatus('Escuchando...');
    } catch (error) {
      console.error('Error al iniciar reconocimiento:', error);
      this.updateStatus('Error al iniciar reconocimiento');
    }
  }
  
  stopListening() {
    if (!this.recognition || !this.isListening) return;
    
    try {
      this.recognition.stop();
      this.isListening = false;
      this.btnListen.classList.remove('active');
      this.updateStatus('Reconocimiento detenido');
    } catch (error) {
      console.error('Error al detener reconocimiento:', error);
    }
  }
  
  speak(text) {
    if (!this.synthesis || this.isSpeaking) return;
    
    // Detener cualquier síntesis en curso
    this.synthesis.cancel();
    
    // Crear nuevo utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configurar propiedades
    utterance.voice = this.selectedVoice;
    utterance.lang = this.language;
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    utterance.volume = this.volume;
    
    // Configurar eventos
    utterance.onstart = () => {
      this.isSpeaking = true;
      this.btnSpeak.classList.add('active');
      this.updateStatus('Hablando...');
    };
    
    utterance.onend = () => {
      this.isSpeaking = false;
      this.btnSpeak.classList.remove('active');
      this.updateStatus('Lectura completada');
    };
    
    utterance.onerror = (event) => {
      console.error('Error en síntesis de voz:', event);
      this.isSpeaking = false;
      this.btnSpeak.classList.remove('active');
      this.updateStatus('Error en síntesis de voz');
    };
    
    // Iniciar síntesis
    this.synthesis.speak(utterance);
  }
  
  stopSpeaking() {
    if (!this.synthesis || !this.isSpeaking) return;
    
    this.synthesis.cancel();
    this.isSpeaking = false;
    this.btnSpeak.classList.remove('active');
    this.updateStatus('Lectura detenida');
  }
  
  getLastAIMessage() {
    // Obtener el último mensaje de ARKAIOS en el chat
    const messages = document.querySelectorAll('.msg.ai');
    if (messages.length > 0) {
      return messages[messages.length - 1].textContent;
    }
    return null;
  }
  
  updateStatus(message) {
    if (this.statusElement) {
      this.statusElement.textContent = message;
      
      // Limpiar el mensaje después de 3 segundos
      setTimeout(() => {
        if (this.statusElement.textContent === message) {
          this.statusElement.textContent = '';
        }
      }, 3000);
    }
  }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.arkaiosVoice = new ArkaiosVoice();
});