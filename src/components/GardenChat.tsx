import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Trash2, Sprout, Loader2, ArrowRight, BookOpen, Quote } from 'lucide-react';
import { ChatMessage } from '../types.js';

interface GardenChatProps {
  chatHistory: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onClearHistory: () => Promise<void>;
  onFocusItem: (id: string) => void;
}

const QUICK_SUGGESTIONS = [
  "What have I been learning recently?",
  "Recommend what I should explore next.",
  "Are there any contradictions in my garden?",
  "List key takeaways from my saved notes."
];

export default function GardenChat({ chatHistory, onSendMessage, onClearHistory, onFocusItem }: GardenChatProps) {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isSending]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const msg = inputText.trim();
    setInputText('');
    setIsSending(true);
    await onSendMessage(msg);
    setIsSending(false);
  };

  const handleSuggestionClick = async (suggestion: string) => {
    if (isSending) return;
    setIsSending(true);
    await onSendMessage(suggestion);
    setIsSending(false);
  };

  // Custom regex markdown formatter to render bold, list items, headers and quotes nicely
  const formatMessageText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let content = line;
      
      // Headers
      if (line.startsWith('### ')) {
        return <h5 key={idx} className="text-sm font-semibold text-garden-slate mt-4 mb-2 font-display">{line.substring(4)}</h5>;
      }
      if (line.startsWith('## ')) {
        return <h4 key={idx} className="text-base font-bold text-sage-800 mt-5 mb-2 font-display">{line.substring(3)}</h4>;
      }
      if (line.startsWith('# ')) {
        return <h3 key={idx} className="text-lg font-bold text-sage-900 mt-6 mb-3 font-display">{line.substring(2)}</h3>;
      }

      // Blockquote
      if (line.startsWith('> ')) {
        return (
          <blockquote key={idx} className="pl-3 border-l-2 border-sage-300 italic text-sage-500 my-2 text-xs">
            {line.substring(2)}
          </blockquote>
        );
      }

      // Bullet points
      let isBullet = false;
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        isBullet = true;
        content = line.trim().substring(2);
      }

      // Format Bold (**text**) and Citations ([title]) inline
      const parts: React.ReactNode[] = [];
      let temp = content;
      
      // Inline parser loop for bold and citations
      const inlineRegex = /(\*\*.*?\*\*|\[.*?\])/g;
      const splitParts = temp.split(inlineRegex);

      splitParts.forEach((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          parts.push(<strong key={pIdx} className="font-semibold text-garden-slate">{part.slice(2, -2)}</strong>);
        } else if (part.startsWith('[') && part.endsWith(']')) {
          const itemTitle = part.slice(1, -1);
          parts.push(
            <span 
              key={pIdx} 
              className="inline-flex items-center gap-0.5 px-2 py-0.5 mx-0.5 rounded bg-sage-100 text-sage-800 font-medium text-[10px] cursor-pointer hover:bg-sage-200 hover:text-sage-950 transition border border-sage-200"
              onClick={() => {
                // Find matching item title in citations or match directly
                onFocusItem(itemTitle);
              }}
              title={`Reveal "${itemTitle}"`}
            >
              <BookOpen className="w-2.5 h-2.5 shrink-0" />
              {itemTitle}
            </span>
          );
        } else {
          parts.push(part);
        }
      });

      if (isBullet) {
        return (
          <li key={idx} className="ml-4 list-disc text-xs text-sage-600 leading-relaxed mb-1">
            {parts}
          </li>
        );
      }

      return (
        <p key={idx} className="text-xs text-sage-600 leading-relaxed mb-2 min-h-[1px]">
          {parts}
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col h-full bg-garden-cream">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sage-100 bg-white shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sage-50 text-sage-600 border border-sage-100 animate-bloom">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-display font-semibold text-sm text-garden-slate leading-none">
              AI Gardener Assistant
            </h4>
            <span className="text-[10px] text-sage-400 font-mono">
              Grounded on your garden data
            </span>
          </div>
        </div>
        <button 
          onClick={onClearHistory}
          className="p-1.5 rounded-lg text-sage-400 hover:text-rose-600 hover:bg-rose-50 transition"
          title="Sweep Conversation Logs"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.map((msg) => {
          const isBot = msg.sender === 'bot';
          return (
            <div 
              key={msg.id} 
              className={`flex flex-col max-w-[85%] ${
                isBot ? 'self-start' : 'self-end ml-auto'
              }`}
            >
              {/* Sender Tag */}
              <span className={`text-[9px] font-semibold uppercase tracking-wider mb-1 font-mono ${
                isBot ? 'text-sage-400' : 'text-right text-sage-500'
              }`}>
                {isBot ? 'AI Gardener' : 'Me'}
              </span>

              {/* Message Bubble */}
              <div 
                className={`p-3.5 rounded-2xl text-xs border shadow-sm ${
                  isBot 
                    ? 'bg-white border-sage-100 text-garden-slate rounded-tl-sm' 
                    : 'bg-sage-600 border-sage-700 text-white rounded-tr-sm'
                }`}
              >
                {isBot ? (
                  formatMessageText(msg.text)
                ) : (
                  <p className="leading-relaxed">{msg.text}</p>
                )}

                {/* Citations Footer */}
                {isBot && msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-sage-50">
                    <span className="text-[9px] font-semibold text-sage-400 uppercase tracking-widest font-mono block mb-1">
                      Referenced Sprouts
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {msg.citations.map((cite) => (
                        <button
                          key={cite.id}
                          onClick={() => onFocusItem(cite.id)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sage-50/50 hover:bg-sage-100 text-sage-600 font-medium text-[10px] border border-sage-100 transition truncate max-w-[150px]"
                        >
                          <Sprout className="w-2.5 h-2.5 text-sage-400 shrink-0" />
                          <span className="truncate">{cite.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex flex-col max-w-[80%] self-start">
            <span className="text-[9px] font-semibold text-sage-400 uppercase tracking-wider font-mono mb-1">
              AI Gardener
            </span>
            <div className="flex items-center gap-2 p-4 rounded-2xl bg-white border border-sage-100 text-sage-400 shadow-sm rounded-tl-sm">
              <Loader2 className="w-4 h-4 animate-spin text-sage-500" />
              <span className="text-xs text-sage-500 italic">Watering sprouts of knowledge...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions (Only if chat is quiet) */}
      {chatHistory.length <= 1 && !isSending && (
        <div className="px-4 pb-2">
          <span className="text-[10px] font-semibold text-sage-400 uppercase tracking-wider block mb-2 font-mono">
            Suggested Garden Prompts
          </span>
          <div className="grid grid-cols-1 gap-1.5">
            {QUICK_SUGGESTIONS.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestionClick(suggestion)}
                className="flex items-center justify-between text-left p-2.5 rounded-xl bg-white hover:bg-sage-50/50 border border-sage-100 text-xs text-sage-600 hover:text-garden-slate transition group text-ellipsis overflow-hidden"
              >
                <span className="truncate mr-2">{suggestion}</span>
                <ArrowRight className="w-3.5 h-3.5 text-sage-400 group-hover:translate-x-0.5 transition" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Field Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-sage-100 bg-white">
        <div className="relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask me to summarize, find connections..."
            className="w-full py-3 pl-4 pr-12 text-xs border border-sage-100 rounded-xl focus:ring-2 focus:ring-sage-300 focus:outline-none bg-garden-cream text-garden-slate placeholder-sage-300"
            disabled={isSending}
            required
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-sage-600 text-white hover:bg-sage-700 disabled:opacity-50 disabled:hover:bg-sage-600 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
