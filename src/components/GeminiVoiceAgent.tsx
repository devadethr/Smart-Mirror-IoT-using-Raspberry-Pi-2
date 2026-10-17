import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Sparkles, MessageSquare, Send, Check, RefreshCw } from 'lucide-react';
import { CalendarEvent, TodoItem, WeatherData } from '../types';

interface GeminiVoiceAgentProps {
  userName: string;
  weather: WeatherData;
  events: CalendarEvent[];
  todos: TodoItem[];
  onAddTask: (task: string) => void;
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'mirror';
  text: string;
  timestamp: string;
  actionTaken?: string;
}

export const GeminiVoiceAgent: React.FC<GeminiVoiceAgentProps> = ({
  userName,
  weather,
  events,
  todos,
  onAddTask,
  onAddEvent
}) => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [transcriptInput, setTranscriptInput] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-init',
      sender: 'mirror',
      text: `Hello ${userName || 'there'}! I am your SmartMirror voice assistant. Ask me about your schedule, weather, traffic, or tell me to add tasks!`,
      timestamp: 'Just now'
    }
  ]);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Setup SpeechRecognition if supported
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text) {
          handleUserVoiceQuery(text);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Voice output via Web Speech API
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Process user speech or query with SmartMirror intelligence
  const handleUserVoiceQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setTranscriptInput('');
    setIsProcessing(true);

    try {
      // Local context summary
      const upcomingEventTitles = events.slice(0, 3).map(e => `${e.title} at ${e.start_time}`).join(', ');
      const pendingTaskCount = todos.filter(t => !t.is_completed).length;

      // Intelligent intent parsing for quick voice execution
      const lower = queryText.toLowerCase();
      let reply = '';
      let actionTaken = '';

      if (lower.includes('add task') || lower.includes('add a task') || lower.includes('to do') || lower.includes('remind me to')) {
        const taskContent = queryText
          .replace(/add task:?/i, '')
          .replace(/add a task:?/i, '')
          .replace(/remind me to:?/i, '')
          .trim();
        if (taskContent) {
          onAddTask(taskContent);
          actionTaken = `Added task: "${taskContent}"`;
          reply = `I've added "${taskContent}" to your SmartMirror to-do list!`;
        } else {
          reply = `What task would you like me to add?`;
        }
      } else if (lower.includes('schedule') || lower.includes('calendar') || lower.includes('events') || lower.includes('plans')) {
        if (events.length > 0) {
          reply = `You have ${events.length} event${events.length > 1 ? 's' : ''} scheduled: ${upcomingEventTitles}.`;
        } else {
          reply = `Your calendar is clear for today! No upcoming events scheduled.`;
        }
      } else if (lower.includes('weather') || lower.includes('temperature') || lower.includes('rain') || lower.includes('outside')) {
        reply = `It is currently ${weather.temperature}${weather.unit} and ${weather.condition} in ${weather.city || 'your area'}, with a high of ${weather.forecast?.[0]?.high || 70} degrees.`;
      } else if (lower.includes('traffic') || lower.includes('commute') || lower.includes('drive')) {
        reply = `Commute conditions are normal with clear highway flow. Expect around 20 to 25 minutes to Downtown.`;
      } else if (lower.includes('task') || lower.includes('to-do') || lower.includes('what do i need to do')) {
        reply = `You have ${pendingTaskCount} pending task${pendingTaskCount !== 1 ? 's' : ''} on your mirror to-do list.`;
      } else {
        reply = `Good morning ${userName || 'friend'}! All systems are synced on your SmartMirror. The temperature is ${weather.temperature}${weather.unit} and your day is looking great.`;
      }

      const mirrorMsg: ChatMessage = {
        id: `m-${Date.now()}`,
        sender: 'mirror',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionTaken: actionTaken || undefined
      };

      setMessages(prev => [...prev, mirrorMsg]);
      speakText(reply);

    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleMic = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch {
          setIsListening(false);
        }
      } else {
        // Simulated voice prompt if speech recognition not supported in browser
        handleUserVoiceQuery("What is on my schedule today?");
      }
    }
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-950 border border-purple-800 text-purple-400 rounded-lg">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Gemini Voice Conversations</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800">
                Live Speech
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Speak naturally to manage your SmartMirror, query routes &amp; hear responses
            </p>
          </div>
        </div>

        {isSpeaking && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-950/80 border border-sky-800 text-sky-400 text-xs">
            <Volume2 className="w-3.5 h-3.5 animate-bounce" />
            <span className="font-mono">Speaking...</span>
          </div>
        )}
      </div>

      {/* Voice Visualizer / Mic Action Card */}
      <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center relative overflow-hidden">
        
        {/* Pulsing Aura when listening or speaking */}
        {(isListening || isSpeaking) && (
          <div className="absolute inset-0 bg-sky-500/10 animate-pulse pointer-events-none" />
        )}

        {/* Large Mic Button */}
        <button
          onClick={toggleMic}
          className={`w-16 h-16 rounded-full flex items-center justify-center text-white transition-all shadow-xl active:scale-95 ${
            isListening
              ? 'bg-red-600 ring-4 ring-red-500/40 animate-pulse'
              : 'bg-gradient-to-tr from-sky-600 to-purple-600 hover:from-sky-500 hover:to-purple-500'
          }`}
          title={isListening ? 'Stop listening' : 'Start voice conversation'}
        >
          {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
        </button>

        <p className="text-xs font-semibold text-white mt-3">
          {isListening
            ? 'Listening... Speak your command or question'
            : isSpeaking
            ? 'SmartMirror is speaking...'
            : 'Tap microphone to talk to SmartMirror'}
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Or select a sample conversation query below
        </p>

        {/* Quick Voice Chips */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
          {[
            "What's on my schedule today?",
            "How is the weather?",
            "Add task: Review science project",
            "How is traffic to downtown?",
            "Add task: Buy 2-way glass mounting clips"
          ].map(chip => (
            <button
              key={chip}
              onClick={() => handleUserVoiceQuery(chip)}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 active:scale-95 rounded-full text-[11px] text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              "{chip}"
            </button>
          ))}
        </div>
      </div>

      {/* Conversation History Log */}
      <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`p-3 rounded-xl border text-xs leading-relaxed ${
              msg.sender === 'user'
                ? 'bg-slate-950 border-slate-800 ml-6 text-slate-200'
                : 'bg-slate-800/80 border-slate-700/70 mr-6 text-white'
            }`}
          >
            <div className="flex items-center justify-between mb-1 text-[10px] text-slate-400 font-medium">
              <span>{msg.sender === 'user' ? 'You' : 'SmartMirror Voice'}</span>
              <span>{msg.timestamp}</span>
            </div>
            <div>{msg.text}</div>
            {msg.actionTaken && (
              <div className="mt-2 pt-1.5 border-t border-slate-700/60 flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                <Check className="w-3 h-3" />
                <span>{msg.actionTaken}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Manual query input */}
      <form
        onSubmit={e => {
          e.preventDefault();
          handleUserVoiceQuery(transcriptInput);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={transcriptInput}
          onChange={e => setTranscriptInput(e.target.value)}
          placeholder="Or type a voice command..."
          className="flex-1 h-10 bg-slate-950 border border-slate-700 rounded-lg px-3 text-xs text-white focus:outline-none focus:border-sky-500"
        />
        <button
          type="submit"
          className="h-10 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center shrink-0 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

    </div>
  );
};
