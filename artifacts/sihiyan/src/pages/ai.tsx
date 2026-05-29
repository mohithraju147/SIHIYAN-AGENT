import React, { useState, useRef, useEffect } from "react";
import {
  useListGeminiConversations,
  useCreateGeminiConversation,
  useDeleteGeminiConversation,
  useListGeminiMessages,
  getListGeminiConversationsQueryKey,
  getListGeminiMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { BotMessageSquare, Plus, Send, Trash2, Loader2, User, Bot } from "lucide-react";

type Message = {
  id: number;
  role: string;
  content: string;
  createdAt: string;
};

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) return <h3 key={i} className="font-bold text-base mt-2">{line.slice(4)}</h3>;
        if (line.startsWith("## ")) return <h2 key={i} className="font-bold text-lg mt-3">{line.slice(3)}</h2>;
        if (line.startsWith("# ")) return <h1 key={i} className="font-bold text-xl mt-3">{line.slice(2)}</h1>;
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return <div key={i} className="flex gap-2 ml-2"><span className="text-primary mt-0.5">-</span><span>{line.slice(2)}</span></div>;
        }
        if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
          return <p key={i} className="font-bold">{line.slice(2, -2)}</p>;
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

export default function AI() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [inputText, setInputText] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [newConvTitle, setNewConvTitle] = useState("");
  const [newConvOpen, setNewConvOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useListGeminiConversations();
  const { data: messages = [] } = useListGeminiMessages(
    activeConvId!,
    { query: { enabled: !!activeConvId, queryKey: getListGeminiMessagesQueryKey(activeConvId!) } }
  );

  const createConv = useCreateGeminiConversation();
  const deleteConv = useDeleteGeminiConversation();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, streamingContent]);

  const handleCreateConversation = () => {
    const title = newConvTitle.trim() || "New conversation";
    createConv.mutate(
      { data: { title } },
      {
        onSuccess: (conv) => {
          qc.invalidateQueries({ queryKey: getListGeminiConversationsQueryKey() });
          setActiveConvId(conv.id);
          setNewConvTitle("");
          setNewConvOpen(false);
        },
        onError: () => toast({ title: "Failed to create conversation", variant: "destructive" }),
      }
    );
  };

  const handleDeleteConv = (id: number) => {
    if (!confirm("Delete this conversation?")) return;
    deleteConv.mutate(
      { id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListGeminiConversationsQueryKey() });
          if (activeConvId === id) setActiveConvId(null);
        },
      }
    );
  };

  const handleSend = async () => {
    if (!inputText.trim() || !activeConvId || isStreaming) return;

    const content = inputText.trim();
    setInputText("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch(`/api/gemini/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                setStreamingContent((prev) => prev + data.content);
              }
              if (data.done || data.error) {
                setIsStreaming(false);
                setStreamingContent("");
                qc.invalidateQueries({ queryKey: getListGeminiMessagesQueryKey(activeConvId) });
              }
            } catch {}
          }
        }
      }
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const allMessages: Message[] = [...messages];

  return (
    <div className="h-full flex gap-4 animate-in fade-in duration-500" style={{ height: "calc(100vh - 8rem)" }}>
      {/* Sidebar */}
      <div className="w-64 shrink-0 flex flex-col bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={() => setNewConvOpen(!newConvOpen)}
          >
            <Plus className="h-4 w-4" /> New Chat
          </Button>
          {newConvOpen && (
            <div className="mt-3 space-y-2">
              <Input
                placeholder="Conversation title..."
                value={newConvTitle}
                onChange={(e) => setNewConvTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateConversation()}
                autoFocus
              />
              <Button size="sm" className="w-full" onClick={handleCreateConversation} disabled={createConv.isPending}>
                Start
              </Button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No conversations yet.</p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                  activeConvId === conv.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
                onClick={() => setActiveConvId(conv.id)}
              >
                <span className="truncate flex-1">{conv.title}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className={`h-5 w-5 p-0 opacity-0 group-hover:opacity-100 ml-1 ${activeConvId === conv.id ? "text-primary-foreground hover:text-primary-foreground hover:bg-primary/80" : ""}`}
                  onClick={(e) => { e.stopPropagation(); handleDeleteConv(conv.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-card border border-border rounded-xl overflow-hidden">
        {!activeConvId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <BotMessageSquare className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">SIHIYAN AI Assistant</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              Ask anything about seed operations, stock levels, dispatch status, or agriculture logistics.
            </p>
            <Button className="mt-6 gap-2" onClick={() => setNewConvOpen(true)}>
              <Plus className="h-4 w-4" /> Start a new conversation
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {allMessages.length === 0 && !isStreaming && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  No messages yet. Ask anything about your operations.
                </div>
              )}
              {allMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role !== "user" && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="text-sm">{msg.content}</p>
                    ) : (
                      <MarkdownText text={msg.content} />
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
              {isStreaming && streamingContent && (
                <div className="flex gap-3 justify-start">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-muted rounded-bl-sm">
                    <MarkdownText text={streamingContent} />
                    <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-1 rounded" />
                  </div>
                </div>
              )}
              {isStreaming && !streamingContent && (
                <div className="flex gap-3 justify-start">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-muted rounded-bl-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-border p-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask about operations, stock, dispatches..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isStreaming}
                  className="flex-1"
                />
                <Button onClick={handleSend} disabled={isStreaming || !inputText.trim()} size="icon">
                  {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Press Enter to send, Shift+Enter for newline.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
