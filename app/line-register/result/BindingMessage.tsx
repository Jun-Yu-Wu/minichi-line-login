"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BINDING_MESSAGE } from "./message";

export default function BindingMessage() {
  const messageRef = useRef<HTMLSpanElement>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(BINDING_MESSAGE);
      setCopyState("copied");
    } catch {
      if (messageRef.current) {
        const range = document.createRange();
        range.selectNodeContents(messageRef.current);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      setCopyState("manual");
    }
  }

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted px-3 py-5 sm:px-5">
      <span ref={messageRef} className="select-all min-w-0 break-words text-[22px] font-semibold leading-9 text-foreground sm:text-2xl">
        {BINDING_MESSAGE}
      </span>
      <Button
        type="button"
        variant="outline"
        onClick={copyMessage}
        className="h-auto min-h-11 rounded-lg border-input bg-white px-3 py-2.5 text-xs text-foreground shadow-none hover:bg-muted focus-visible:ring-ring sm:text-[13px]"
      >
        {copyState === "copied" ? (
          <Check className="hidden sm:block" aria-hidden="true" />
        ) : (
          <Copy className="hidden sm:block" aria-hidden="true" />
        )}
        {copyState === "copied" ? "已複製" : copyState === "manual" ? "手動複製" : "複製文字"}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {copyState === "copied"
          ? `已複製「${BINDING_MESSAGE}」。`
          : copyState === "manual"
            ? `請選取文字複製，或直接在官方 LINE 聊天室輸入「${BINDING_MESSAGE}」。`
            : ""}
      </span>
    </div>
  );
}
