import React, { useState, useEffect, useRef } from 'react';
import { X, Send, RefreshCw } from 'lucide-react';
import { sendGrokChatMessage } from '../services/aiEngine';
import type { GrokChatResponse } from '../services/aiEngine';

interface RobotAIRobotAssistantProps {
  patientId?: string;
  patientName?: string;
}

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  isError?: boolean;
}

export const RobotAIRobotAssistant: React.FC<RobotAIRobotAssistantProps> = ({
  patientId,
  patientName = 'Alex Rivera'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-welcome',
      sender: 'bot',
      text: patientId
        ? `Hello! I am NeuroCare Robot AI. I have loaded verified clinical telemetry and mortality predictions for Patient #${patientId} (${patientName}). How can I assist you?`
        : `Hello! I am NeuroCare Robot AI assistant. Select a patient or ask me general questions about the ICU Early Warning platform.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (patientId) {
      setMessages([
        {
          id: `msg-welcome-${patientId}`,
          sender: 'bot',
          text: `Hello! I am NeuroCare Robot AI. I have loaded verified clinical telemetry and mortality predictions for Patient #${patientId} (${patientName || 'ICU Patient'}). How can I assist you?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [patientId, patientName]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string, explicitIntent?: string) => {
    const query = textToSend || inputValue.trim();
    if (!query || isLoading) return;

    const userMsg: Message = {
      id: `msg-u-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue('');
    setIsLoading(true);

    const activeId = patientId || '132547';
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const conversationId = `conv-${activeId}`;

    const res: GrokChatResponse = await sendGrokChatMessage(activeId, query, explicitIntent, conversationId, requestId);

    const botMsg: Message = {
      id: `msg-b-${Date.now()}`,
      sender: 'bot',
      text: res.response,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages((prev) => [...prev, botMsg]);
    setIsLoading(false);
  };

  const handleQuickAction = (actionText: string, intent: string) => {
    handleSendMessage(actionText, intent);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* CLOSED STATE — FLOATING DOCTOR ASSISTANT BUTTON */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open NeuroCare AI assistant"
          className="group relative flex items-center justify-center w-14 h-14 bg-[#0F172A] border-2 border-[#FF897E] text-slate-100 rounded-2xl shadow-2xl hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[#FF897E]/50 overflow-visible"
        >
          {/* Subtle antenna light */}
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#16A34A] rounded-full shadow-[0_0_8px_#16A34A] animate-pulse"></span>
          
          {/* Doctor Assistant Avatar Image */}
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl overflow-hidden bg-slate-800">
            <img
              src="/doctor-assistant.png"
              alt="NeuroCare Doctor Assistant"
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0F172A]"></span>
          </div>

          <span className="sr-only">Open NeuroCare AI assistant</span>
        </button>
      )}

      {/* OPEN STATE — COMPACT AI ASSISTANT PANEL */}
      {isOpen && (
        <div className="w-[360px] sm:w-[420px] h-[540px] max-h-[85vh] bg-[#0F172A] border-2 border-[#FF897E]/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
          
          {/* ASSISTANT HEADER */}
          <div className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 bg-slate-800 border border-[#FF897E] rounded-xl overflow-hidden flex shrink-0 items-center justify-center">
                <img
                  src="/doctor-assistant.png"
                  alt="NeuroCare Doctor Assistant"
                  className="w-full h-full object-cover"
                />
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-900 animate-ping"></span>
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-900"></span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold tracking-wide text-slate-100 font-mono">Dr. AI Assistant</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-700/50 font-mono">
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  {patientId ? `Patient #${patientId} (${patientName})` : 'ICU Clinical Assistant'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close NeuroCare AI assistant"
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* MESSAGES CONTAINER */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-950/70 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start items-start gap-2'}`}
              >
                {msg.sender === 'bot' && (
                  <img
                    src="/doctor-assistant.png"
                    alt="Doctor AI"
                    className="w-6 h-6 rounded-full border border-[#FF897E] object-cover shrink-0 mt-1"
                  />
                )}
                <div className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[85%] p-3 rounded-xl shadow-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-[#FF897E] text-slate-950 font-medium rounded-br-none'
                        : msg.isError
                        ? 'bg-rose-950/80 border border-rose-700 text-rose-200 rounded-bl-none'
                        : 'bg-slate-800/90 border border-slate-700/80 text-slate-200 rounded-bl-none font-mono text-[11.5px]'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 font-mono px-1">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs font-mono p-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#FF897E]" />
                <span>NeuroCare AI analyzing patient context...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* CHAT QUICK ACTIONS */}
          <div className="p-2 bg-slate-900 border-t border-slate-800 overflow-x-auto flex items-center gap-1.5 scrollbar-none">
            <button
              onClick={() => handleQuickAction("Explain Patient", "patient_summary")}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-mono rounded-lg border border-slate-700 whitespace-nowrap transition-colors"
            >
              Explain Patient
            </button>
            <button
              onClick={() => handleQuickAction("Explain Risk", "risk_explanation")}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-mono rounded-lg border border-slate-700 whitespace-nowrap transition-colors"
            >
              Explain Risk
            </button>
            <button
              onClick={() => handleQuickAction("Recent Changes", "recent_changes")}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-mono rounded-lg border border-slate-700 whitespace-nowrap transition-colors"
            >
              Recent Changes
            </button>
            <button
              onClick={() => handleQuickAction("Explain Trends", "trends")}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-mono rounded-lg border border-slate-700 whitespace-nowrap transition-colors"
            >
              Explain Trends
            </button>
            <button
              onClick={() => handleQuickAction("Missing Data", "missing_data")}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-mono rounded-lg border border-slate-700 whitespace-nowrap transition-colors"
            >
              Missing Data
            </button>
          </div>

          {/* INPUT FORM */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Grok AI about this patient..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#FF897E] font-mono"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="p-2 bg-[#FF897E] hover:bg-[#ff7669] disabled:opacity-40 text-slate-950 rounded-lg transition-colors focus:outline-none"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
