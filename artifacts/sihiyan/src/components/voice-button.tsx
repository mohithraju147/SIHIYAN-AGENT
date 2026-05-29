import React, { useState, useEffect, useCallback } from "react";
import {
  Mic, MicOff, X, Check, Loader2, Volume2,
  History, ChevronRight, AlertCircle, RefreshCw,
  Package, Truck, BarChart2, FileText, ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useVoiceCommand, type VoiceLanguage, type VoiceCommandResult } from "@/hooks/use-voice-command";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

type HistoryEntry = {
  id: number;
  transcript: string;
  action: string;
  success: boolean;
  resultMessage: string | null;
  executedAt: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const LANGUAGES: { value: VoiceLanguage; label: string; flag: string }[] = [
  { value: "en-US", label: "English", flag: "🇬🇧" },
  { value: "kn-IN", label: "ಕನ್ನಡ", flag: "🇮🇳" },
  { value: "ml-IN", label: "മലയാളം", flag: "🇮🇳" },
];

const ACTION_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  ADD_STOCK: Package,
  ADJUST_STOCK: Package,
  DELETE_STOCK: Package,
  GET_STOCK: Package,
  GET_LOW_STOCK: Package,
  CREATE_DISPATCH: Truck,
  UPDATE_DISPATCH_STATUS: Truck,
  GET_DISPATCH: Truck,
  GENERATE_REPORT: FileText,
  GET_SUMMARY: BarChart2,
  GET_ANALYTICS: BarChart2,
  MOVE_INVENTORY: ArrowRightLeft,
};

const EXAMPLE_COMMANDS = [
  { text: "Add 200 kg cotton seeds", action: "ADD_STOCK" },
  { text: "Add 50 bags to paddy seeds stock", action: "ADJUST_STOCK" },
  { text: "Show all low stock items", action: "GET_LOW_STOCK" },
  { text: "Dispatch 100 kg paddy to Ramesh in Bengaluru", action: "CREATE_DISPATCH" },
  { text: "Mark Ramesh's dispatch as delivered", action: "UPDATE_DISPATCH_STATUS" },
  { text: "Generate daily operations report", action: "GENERATE_REPORT" },
  { text: "Give me a summary of operations", action: "GET_SUMMARY" },
  { text: "Show inventory analytics", action: "GET_ANALYTICS" },
  { text: "Move 20 kg sunflower from Mysuru to Hubballi", action: "MOVE_INVENTORY" },
  { text: "Delete tomato seeds", action: "DELETE_STOCK" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function actionLabel(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, c => c);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-IN");
}

// ─── Mic button visuals ───────────────────────────────────────────────────────

const STATE_RING: Record<string, string> = {
  idle: "ring-primary/20",
  listening: "ring-red-400 ring-4 animate-pulse",
  processing: "ring-amber-400 ring-2",
  confirming: "ring-blue-400 ring-2",
  done: "ring-emerald-400 ring-2",
  error: "ring-destructive ring-2",
};

const STATE_BG: Record<string, string> = {
  idle: "bg-primary",
  listening: "bg-red-500",
  processing: "bg-amber-500",
  confirming: "bg-blue-500",
  done: "bg-emerald-500",
  error: "bg-destructive",
};

// ─── Result display card ──────────────────────────────────────────────────────

function ResultCard({ result }: { result: VoiceCommandResult }) {
  const Icon = ACTION_ICON[result.action] ?? Volume2;
  const isSuccess = result.success !== false;

  return (
    <div className={`rounded-xl border p-4 ${isSuccess ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-lg p-1.5 ${isSuccess ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-red-100 dark:bg-red-900/50"}`}>
          <Icon className={`h-4 w-4 ${isSuccess ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {actionLabel(result.action)}
            </span>
            {result.confidence !== undefined && (
              <Badge variant="outline" className="text-xs h-4 px-1">
                {Math.round((result.confidence ?? 1) * 100)}% match
              </Badge>
            )}
          </div>
          <p className={`text-sm font-medium leading-snug ${isSuccess ? "text-emerald-800 dark:text-emerald-200" : "text-red-800 dark:text-red-200"}`}>
            {result.message}
          </p>
        </div>
        {isSuccess ? (
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VoiceButton() {
  const [language, setLanguage] = useState<VoiceLanguage>("en-US");
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("command");
  const qc = useQueryClient();
  const { toast } = useToast();

  const handleResult = useCallback((r: VoiceCommandResult) => {
    qc.invalidateQueries();
    if (r.success !== false) {
      toast({
        title: actionLabel(r.action),
        description: r.message,
      });
    }
  }, [qc, toast]);

  const {
    state, transcript, result, error,
    isSupported, startListening, stopListening, confirmAction, reset,
  } = useVoiceCommand({ language, onResult: handleResult });

  // Load history when switching to history tab
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/voice/history");
      if (res.ok) setHistory(await res.json());
    } catch { /* silent */ }
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === "history" && open) loadHistory();
  }, [activeTab, open, loadHistory]);

  // Refresh history after each successful command
  useEffect(() => {
    if (state === "done" && activeTab === "history") loadHistory();
  }, [state, activeTab, loadHistory]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    setActiveTab("command");
  }, []);

  const handleClose = useCallback(() => {
    stopListening();
    reset();
    setOpen(false);
  }, [stopListening, reset]);

  const handleMicClick = useCallback(() => {
    if (state === "listening") {
      stopListening();
    } else if (state === "idle" || state === "error") {
      reset();
      startListening();
    } else if (state === "done") {
      reset();
      setTimeout(() => startListening(), 100);
    }
  }, [state, stopListening, reset, startListening]);

  const handleConfirm = useCallback(async () => {
    await confirmAction();
    qc.invalidateQueries();
  }, [confirmAction, qc]);

  if (!isSupported) return null;

  const isBusy = state === "processing";

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {/* Language pill */}
        <div
          className="flex items-center gap-1.5 bg-card border border-border rounded-full px-2.5 py-1 shadow-sm cursor-pointer hover:bg-secondary/60 transition-colors text-xs"
          onClick={handleOpen}
        >
          <Select value={language} onValueChange={(v) => setLanguage(v as VoiceLanguage)}>
            <SelectTrigger
              className="h-5 border-0 bg-transparent p-0 shadow-none text-xs w-auto gap-1 focus:ring-0"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  <span className="flex items-center gap-1.5 text-xs">{l.flag} {l.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">Voice</span>
        </div>

        {/* Mic FAB */}
        <button
          onClick={() => { handleOpen(); if (state === "idle") { reset(); startListening(); } }}
          className={`relative w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center transition-all ring ${STATE_RING[state] ?? STATE_RING.idle} ${STATE_BG[state] ?? STATE_BG.idle}`}
          title="Voice command"
        >
          {state === "processing" ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : state === "listening" ? (
            <MicOff className="h-6 w-6" />
          ) : state === "done" ? (
            <Check className="h-6 w-6" />
          ) : state === "error" ? (
            <AlertCircle className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Main dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Volume2 className="h-4 w-4 text-primary" />
              </div>
              Voice Operations
              <Badge variant="outline" className="ml-auto text-xs font-normal">
                {LANGUAGES.find(l => l.value === language)?.flag}{" "}
                {LANGUAGES.find(l => l.value === language)?.label}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="px-5">
              <TabsList className="w-full h-8 text-xs">
                <TabsTrigger value="command" className="flex-1 text-xs gap-1.5">
                  <Mic className="h-3 w-3" /> Command
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 text-xs gap-1.5">
                  <History className="h-3 w-3" /> History
                </TabsTrigger>
                <TabsTrigger value="guide" className="flex-1 text-xs gap-1.5">
                  <ChevronRight className="h-3 w-3" /> Guide
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── Command tab ─────────────────────────────────────────── */}
            <TabsContent value="command" className="mt-0 focus-visible:outline-none">
              <div className="px-5 py-4 space-y-4">
                {/* Big mic button */}
                <div className="flex flex-col items-center gap-3 py-2">
                  <button
                    onClick={handleMicClick}
                    disabled={isBusy}
                    className={`relative w-20 h-20 rounded-full text-white shadow-md flex items-center justify-center transition-all ring-4 ${STATE_RING[state] ?? STATE_RING.idle} ${STATE_BG[state] ?? STATE_BG.idle} disabled:opacity-60`}
                  >
                    {state === "processing" ? (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    ) : state === "listening" ? (
                      <MicOff className="h-8 w-8" />
                    ) : state === "done" ? (
                      <Check className="h-8 w-8" />
                    ) : state === "error" ? (
                      <AlertCircle className="h-8 w-8" />
                    ) : (
                      <Mic className="h-8 w-8" />
                    )}
                  </button>
                  <div className="text-center">
                    <p className="text-sm font-semibold">
                      {state === "idle" && "Tap mic to speak"}
                      {state === "listening" && "Listening… speak now"}
                      {state === "processing" && "Processing command…"}
                      {state === "confirming" && "Confirm this action?"}
                      {state === "done" && "Done — tap to speak again"}
                      {state === "error" && "Error — tap to retry"}
                    </p>
                    {state === "listening" && (
                      <p className="text-xs text-muted-foreground mt-0.5">Tap again to stop</p>
                    )}
                  </div>
                </div>

                {/* Transcript */}
                {transcript && (
                  <div className="bg-muted/50 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-muted-foreground mb-0.5">You said:</p>
                    <p className="text-sm font-medium">&ldquo;{transcript}&rdquo;</p>
                  </div>
                )}

                {/* Confirmation card */}
                {result && state === "confirming" && (
                  <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">
                          Confirm: {actionLabel(result.action)}
                        </p>
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          {result.confirmationPrompt ?? result.message}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => { reset(); }}>
                        <X className="h-3 w-3 mr-1" /> Cancel
                      </Button>
                      <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleConfirm}>
                        <Check className="h-3 w-3 mr-1" /> Yes, Confirm
                      </Button>
                    </div>
                  </div>
                )}

                {/* Result card */}
                {result && state === "done" && <ResultCard result={result} />}

                {/* Error card */}
                {error && state === "error" && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-destructive">{error}</p>
                    </div>
                    <button onClick={() => { reset(); startListening(); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" /> Retry
                    </button>
                  </div>
                )}
              </div>

              {/* Footer buttons */}
              <div className="px-5 pb-5">
                {state === "idle" || state === "error" ? (
                  <Button
                    className="w-full gap-2 h-10"
                    onClick={() => { reset(); startListening(); }}
                  >
                    <Mic className="h-4 w-4" /> Start Listening
                  </Button>
                ) : state === "done" ? (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 h-9 text-sm" onClick={handleClose}>
                      Done
                    </Button>
                    <Button className="flex-1 h-9 text-sm gap-1.5" onClick={() => { reset(); startListening(); }}>
                      <Mic className="h-3.5 w-3.5" /> Another Command
                    </Button>
                  </div>
                ) : state !== "confirming" ? (
                  <Button variant="outline" className="w-full h-9 text-sm" onClick={handleClose}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </TabsContent>

            {/* ── History tab ─────────────────────────────────────────── */}
            <TabsContent value="history" className="mt-0 focus-visible:outline-none">
              <div className="px-5 pt-3 pb-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Last 50 voice commands</p>
                <button
                  onClick={loadHistory}
                  disabled={historyLoading}
                  className="text-xs text-primary flex items-center gap-1 hover:opacity-80"
                >
                  <RefreshCw className={`h-3 w-3 ${historyLoading ? "animate-spin" : ""}`} /> Refresh
                </button>
              </div>
              <ScrollArea className="h-80 px-5 pb-4">
                {historyLoading && (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading history…
                  </div>
                )}
                {!historyLoading && history.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                    <History className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No commands yet. Start speaking!</p>
                  </div>
                )}
                {!historyLoading && history.length > 0 && (
                  <div className="space-y-2 pb-2">
                    {history.map((entry) => {
                      const Icon = ACTION_ICON[entry.action] ?? Volume2;
                      return (
                        <div
                          key={entry.id}
                          className={`rounded-lg border px-3 py-2.5 text-xs ${entry.success ? "border-border" : "border-destructive/20 bg-destructive/5"}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={`h-3 w-3 ${entry.success ? "text-primary" : "text-destructive"}`} />
                            <span className="font-semibold text-foreground">
                              {actionLabel(entry.action)}
                            </span>
                            <span className="ml-auto text-muted-foreground">{timeAgo(entry.executedAt)}</span>
                          </div>
                          <p className="text-muted-foreground italic mb-1">&ldquo;{entry.transcript}&rdquo;</p>
                          {entry.resultMessage && (
                            <p className={entry.success ? "text-foreground/80" : "text-destructive/80"}>
                              {entry.resultMessage}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* ── Guide tab ───────────────────────────────────────────── */}
            <TabsContent value="guide" className="mt-0 focus-visible:outline-none">
              <ScrollArea className="h-[22rem] px-5 py-3">
                <div className="space-y-4 pb-4">
                  <p className="text-xs text-muted-foreground">
                    Speak naturally — the AI understands intent. Commands execute immediately.
                    Only deletions ask for confirmation.
                  </p>
                  <div className="space-y-2">
                    {EXAMPLE_COMMANDS.map(({ text, action }) => {
                      const Icon = ACTION_ICON[action] ?? Volume2;
                      return (
                        <div
                          key={text}
                          className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5 cursor-pointer hover:bg-muted/60 transition-colors group"
                          onClick={() => {
                            setActiveTab("command");
                            setTimeout(() => startListening(), 200);
                          }}
                        >
                          <div className="mt-0.5 rounded-md bg-primary/10 p-1">
                            <Icon className="h-3 w-3 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground font-medium leading-snug">&ldquo;{text}&rdquo;</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{actionLabel(action)}</p>
                          </div>
                          <ChevronRight className="h-3 w-3 text-muted-foreground mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      );
                    })}
                  </div>
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Supported languages</p>
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      English, ಕನ್ನಡ (Kannada), and മലയാളം (Malayalam). Select language from the pill above the mic button.
                    </p>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
