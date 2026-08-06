"use client";

import { useEffect, useRef, useState } from "react";
import { X, Sparkles, Send, Loader2 } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface PantryChatItem {
  name: string;
  daysLeft: number;
  risk: string;
  ingredientsText?: string | null;
}

interface PantryChatModalProps {
  items: PantryChatItem[];
  dietaryPreference: string;
  onClose: () => void;
}

const SUGGESTED_QUESTIONS = [
  "What's expiring soon?",
  "What can I cook tonight?",
  "What should I use up first?",
];

export default function PantryChatModal({ items, dietaryPreference, onClose }: PantryChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  const sendQuestion = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || isSending) return;
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch("/api/pantry-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, items, dietaryPreference }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.success ? data.answer : "Sorry, I couldn't answer that right now. Try again in a moment." },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Something went wrong. Please try again." }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in fade-in duration-200">
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/90 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center shrink-0">
            <Sparkles size={14} />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-tight">Ask about your pantry</h3>
            <p className="text-[11px] text-foreground/50">Powered by Gemini</p>
          </div>
        </div>
        <button
          onClick={onClose}
          title="Close chat"
          aria-label="Close chat"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 max-w-md mx-auto w-full">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-foreground/60 text-center py-4">Ask me anything about what&apos;s in your pantry.</p>
            <div className="flex flex-col gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendQuestion(q)}
                  className="text-left text-sm px-4 py-3 rounded-xl border border-border bg-card hover:bg-foreground/5 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user" ? "bg-foreground text-background" : "bg-card border border-border text-foreground"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-2.5 bg-card border border-border">
              <Loader2 size={14} className="animate-spin text-foreground/50" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border bg-card/90 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 max-w-md mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendQuestion(input); }}
            placeholder="Ask a question..."
            className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20"
          />
          <button
            onClick={() => sendQuestion(input)}
            disabled={isSending || !input.trim()}
            title="Send"
            aria-label="Send"
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-foreground text-background disabled:opacity-40 transition-opacity"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
