"use client";

import { useEffect, useRef, useState } from "react";

import Tupai from "@/components/Tupai";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const MODEL_LABELS: Record<string, string> = {
  "ai-listener": "Teman Curhat",
  "ai-listener-edukasi": "Edukasi Mental",
};

function labelModel(name: string) {
  return MODEL_LABELS[name] ?? name;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/models")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        const list: string[] = Array.isArray(data.models) ? data.models : [];
        setModels(list);
        setModel((prev) => prev || data.default_model || list[0] || "");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    const assistantId = crypto.randomUUID();
    const history = [...messages, userMessage];

    setMessages([
      ...history,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setInput("");
    setLoading(true);

    const patchAssistant = (content: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content } : m))
      );
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          ...(model ? { model } : {}),
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        patchAssistant(
          `Maaf, terjadi kesalahan: ${data?.error ?? "tidak diketahui"}`
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        patchAssistant(acc);
      }
    } catch {
      patchAssistant("Gagal terhubung ke server. Coba lagi ya.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input);
    }
  }

  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const streamingEmpty =
    loading && (!lastAssistant || lastAssistant.content === "");
  const started = messages.length > 0;

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_42%,rgba(251,191,36,0.28),transparent_65%)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 z-0 h-48 w-48 -translate-x-1/2 rounded-full bg-orange-300/30 blur-3xl motion-safe:animate-blob sm:h-72 sm:w-72" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-14 z-0 flex flex-col items-center justify-center px-6 sm:top-20">
        <div
          className={`relative flex items-center justify-center transition-all duration-700 ease-out ${
            started
              ? "h-[50%] opacity-95 sm:h-[60%] md:h-[66%]"
              : "h-[60%] sm:h-[72%] md:h-[78%]"
          }`}
        >
          <Tupai
            className={`h-full w-auto object-contain drop-shadow-2xl ${
              loading
                ? "motion-safe:animate-bounce-soft"
                : "motion-safe:animate-float"
            }`}
            priority
          />
        </div>
        {!started && (
          <p className="mt-4 max-w-xs text-center text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 sm:mt-5 sm:max-w-sm sm:text-base">
            Teman curhat yang bisa melepas semua perasaan yang ada di pikiranmu.
          </p>
        )}
      </div>

      <header className="relative z-10 flex items-center gap-2.5 border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90 sm:gap-3 sm:px-6 sm:py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-100 dark:bg-zinc-800 sm:h-10 sm:w-10">
          <Tupai className="h-full w-full object-cover" priority />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
            TupAI
          </h1>
          <p className="truncate text-xs text-zinc-500">
            {loading ? "sedang mengetik..." : "online"}
          </p>
        </div>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={loading || models.length === 0}
          aria-label="Pilih model"
          className="max-w-[9.5rem] shrink-0 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 outline-none transition focus:border-indigo-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {models.length === 0 ? (
            <option value={model}>
              {model ? labelModel(model) : "Memuat…"}
            </option>
          ) : (
            models.map((m) => (
              <option key={m} value={m}>
                {labelModel(m)}
              </option>
            ))
          )}
        </select>
        {started && (
          <button
            onClick={() => setMessages([])}
            className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            Bersihkan
          </button>
        )}
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col px-3 pt-3 pb-1 sm:px-6 sm:pt-5 sm:pb-2">
        {lastAssistant && (
          <div className="relative z-20 mx-auto mt-4 w-full max-w-md motion-safe:animate-pop sm:mt-8 sm:max-w-lg">
            <div className="relative rounded-3xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
              <div className="max-h-[28vh] overflow-y-auto px-4 py-3.5 text-left text-sm leading-relaxed text-zinc-800 sm:max-h-[32vh] sm:px-5 sm:py-4 sm:text-[15px] dark:text-zinc-100">
                {streamingEmpty ? (
                  <span className="flex items-center justify-center gap-1.5 py-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                  </span>
                ) : (
                  <p className="whitespace-pre-wrap break-words">
                    {lastAssistant.content}
                  </p>
                )}
              </div>
              <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900" />
            </div>
          </div>
        )}

        {started && lastUser && (
          <div className="mt-auto flex w-full justify-center pt-6 sm:pt-8">
            <div className="relative w-full max-w-md rounded-3xl bg-indigo-600 px-4 py-3.5 text-left text-sm leading-relaxed text-white shadow-xl sm:max-w-lg sm:px-5 sm:py-4 sm:text-[15px]">
              <p className="whitespace-pre-wrap break-words">
                {lastUser.content}
              </p>
            </div>
          </div>
        )}
      </main>

      <div className="relative z-10 border-t border-zinc-200 bg-white/90 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90 sm:px-6 sm:pt-4 sm:pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Tulis pesan ke TupAI..."
            className="max-h-40 flex-1 resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-indigo-900/40"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Kirim"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
