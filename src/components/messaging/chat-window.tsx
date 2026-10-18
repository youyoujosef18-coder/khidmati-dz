"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Send, WifiOff } from "lucide-react";
import { sendMessageAction } from "@/app/actions/messages";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  senderId: string;
  body: string;
  attachmentFileId: string | null;
  readAt: string | null;
  createdAt: string;
}

const POLL_MS = 4000;

/** Chat with reliable polling + graceful reconnection (no realtime provider configured). */
export function ChatWindow({
  conversationId,
  meId,
  initial,
  blocked,
}: {
  conversationId: string;
  meId: string;
  initial: ChatMessage[];
  blocked: boolean;
}) {
  const { t, time, date } = useI18n();
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<{ id: string; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [connection, setConnection] = useState<"ok" | "retrying">("ok");
  const [pending, start] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const failures = useRef(0);
  const last = messages[messages.length - 1]?.createdAt;

  const scrollDown = () => requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
  useEffect(() => {
    scrollDown();
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages/${conversationId}${last ? `?after=${encodeURIComponent(last)}` : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { messages: ChatMessage[] };
      failures.current = 0;
      setConnection("ok");
      if (data.messages.length) {
        setMessages((m) => {
          const seen = new Set(m.map((x) => x.id));
          const merged = [...m, ...data.messages.filter((x) => !seen.has(x.id))];
          return merged;
        });
        scrollDown();
      }
    } catch {
      failures.current += 1;
      setConnection("retrying");
    }
  }, [conversationId, last]);

  useEffect(() => {
    const delay = Math.min(POLL_MS * 2 ** failures.current, 30000);
    const id = setTimeout(poll, delay);
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [poll, messages.length, connection]);

  async function attach(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("bucket", "conversation-attachments");
      fd.set("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) toast(t(data.error ?? "errors.unexpected", data.params), "error");
      else setAttachment({ id: data.id, preview: URL.createObjectURL(file) });
    } finally {
      setUploading(false);
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (pending || (!body.trim() && !attachment)) return;
    if (!navigator.onLine) return toast(t("errors.offline"), "error");
    const text = body;
    const att = attachment;
    start(async () => {
      const res = await sendMessageAction(conversationId, text, att?.id ?? "");
      if (!res.ok) {
        toast(t(res.message ?? "errors.unexpected"), "error");
        return;
      }
      setBody("");
      setAttachment(null);
      const m = res.data as ChatMessage;
      setMessages((all) => (all.some((x) => x.id === m.id) ? all : [...all, m]));
      scrollDown();
    });
  }

  return (
    <div className="flex h-[min(70dvh,640px)] flex-col">
      {connection === "retrying" && (
        <p role="status" className="flex items-center gap-2 border-b border-border bg-warning-50 px-4 py-2 text-xs text-warning">
          <WifiOff className="h-3.5 w-3.5" aria-hidden /> {t("messages.reconnecting")}
        </p>
      )}
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto bg-bg/50 px-4 py-4" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted">{t("messages.noMessages")}</p>}
        {messages.map((m, i) => {
          const mine = m.senderId === meId;
          const day = date(m.createdAt);
          const showDay = i === 0 || date(messages[i - 1]!.createdAt) !== day;
          return (
            <div key={m.id}>
              {showDay && <p className="my-3 text-center text-xs text-muted">{day}</p>}
              <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-card", mine ? "rounded-ee-sm bg-primary text-white" : "rounded-es-sm bg-surface text-text")}>
                  {m.attachmentFileId && (
                    <a href={`/api/files/${m.attachmentFileId}`} target="_blank" rel="noopener" className="mb-1.5 block overflow-hidden rounded-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/files/${m.attachmentFileId}`} alt="" className="max-h-60 w-full object-cover" loading="lazy" />
                    </a>
                  )}
                  {m.body && <p className="whitespace-pre-wrap break-words" dir="auto">{m.body}</p>}
                  <p className={cn("mt-0.5 text-[10px]", mine ? "text-white/70" : "text-muted")}>
                    {time(m.createdAt)}
                    {mine && m.readAt ? ` · ${t("messages.read")}` : ""}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {blocked ? (
        <p className="border-t border-border px-4 py-3 text-center text-sm text-muted">{t("messages.blocked")}</p>
      ) : (
        <form onSubmit={send} className="border-t border-border bg-surface p-3">
          {attachment && (
            <div className="mb-2 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachment.preview} alt="" className="h-14 w-14 rounded-md object-cover" />
              <button type="button" className="text-xs text-error" onClick={() => setAttachment(null)}>
                {t("common.remove")}
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <label className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-md text-muted hover:bg-ink/5" aria-label={t("messages.attach")}>
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => attach(e.target.files?.[0])} />
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) send(e);
              }}
              rows={1}
              maxLength={2000}
              placeholder={t("messages.placeholder")}
              aria-label={t("messages.placeholder")}
              dir="auto"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-md border border-border-strong px-3 py-2.5 text-[0.95rem] focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15"
            />
            <button
              type="submit"
              disabled={pending || (!body.trim() && !attachment)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-primary text-white disabled:opacity-50"
              aria-label={t("messages.send")}
            >
              {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 rtl:-scale-x-100" />}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
