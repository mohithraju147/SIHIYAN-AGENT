import { useState, useRef, useCallback, useEffect } from "react";

export type VoiceLanguage = "en-US" | "kn-IN" | "ml-IN";

export type VoiceCommandResult = {
  action: string;
  confidence?: number;
  details: Record<string, unknown>;
  message: string;
  data?: unknown;
  success?: boolean;
  executed?: boolean;
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
};

export type VoiceState =
  | "idle"
  | "listening"
  | "processing"
  | "confirming"
  | "done"
  | "error";

type UseVoiceCommandOptions = {
  language?: VoiceLanguage;
  onResult?: (result: VoiceCommandResult) => void;
  onTranscript?: (text: string) => void;
  onError?: (err: string) => void;
};

export function useVoiceCommand({
  language = "en-US",
  onResult,
  onTranscript,
  onError,
}: UseVoiceCommandOptions = {}) {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<VoiceCommandResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const abortedRef = useRef(false);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window ||
      "webkitSpeechRecognition" in window);

  const speak = useCallback(
    (text: string) => {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    },
    [language]
  );

  const processTranscript = useCallback(
    async (text: string) => {
      setState("processing");
      try {
        const res = await fetch("/api/voice/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: text, language }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Server error" }));
          throw new Error(err.error ?? "Server error");
        }
        const data: VoiceCommandResult = await res.json();
        setResult(data);

        if (data.requiresConfirmation) {
          setState("confirming");
        } else {
          setState("done");
          speak(data.message);
          onResult?.(data);
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to process command";
        setError(msg);
        setState("error");
        speak("Sorry, I could not complete that command.");
        onError?.(msg);
      }
    },
    [language, onResult, onError, speak]
  );

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError(
        "Speech recognition is not supported. Please use Chrome or Edge."
      );
      setState("error");
      return;
    }
    abortedRef.current = false;
    setState("idle");

    const SR =
      window.SpeechRecognition ??
      (
        window as unknown as {
          webkitSpeechRecognition: typeof SpeechRecognition;
        }
      ).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => setState("listening");

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      onTranscript?.(text);
      processTranscript(text);
    };

    recognition.onerror = (event) => {
      if (abortedRef.current) return;
      const msg =
        event.error === "no-speech"
          ? "No speech detected. Please try again."
          : event.error === "not-allowed"
          ? "Microphone access denied. Allow microphone in browser settings."
          : `Speech recognition error: ${event.error}`;
      setError(msg);
      setState("error");
      onError?.(msg);
    };

    recognition.onend = () => {
      if (state === "listening") setState("idle");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, language, onTranscript, processTranscript, state]);

  const stopListening = useCallback(() => {
    abortedRef.current = true;
    recognitionRef.current?.stop();
    setState("idle");
  }, []);

  const confirmAction = useCallback(async () => {
    if (!result) return;
    setState("processing");
    try {
      const res = await fetch("/api/voice/command/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: result.action,
          details: result.details,
          transcript,
          language,
        }),
      });
      if (!res.ok) throw new Error("Failed to execute command");
      const data = await res.json();
      const updated: VoiceCommandResult = {
        ...result,
        message: data.message ?? result.message,
        data: data.data,
        success: data.success,
        executed: true,
      };
      setResult(updated);
      setState("done");
      speak(updated.message);
      onResult?.(updated);
    } catch {
      setState("error");
      setError("Failed to execute command");
    }
  }, [result, transcript, language, speak, onResult]);

  const reset = useCallback(() => {
    setState("idle");
    setTranscript("");
    setResult(null);
    setError(null);
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  return {
    state,
    transcript,
    result,
    error,
    isSupported,
    startListening,
    stopListening,
    confirmAction,
    reset,
    speak,
  };
}
