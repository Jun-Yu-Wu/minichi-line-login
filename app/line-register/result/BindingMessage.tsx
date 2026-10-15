"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

export const BINDING_MESSAGE = "已完成綁定";

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
    <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#f6f6f6] px-3 py-6 sm:gap-3 sm:px-5">
      <span ref={messageRef} className="select-all whitespace-nowrap text-[22px] font-semibold leading-9 tracking-[0.01em] text-[#202020] sm:text-2xl">
        {BINDING_MESSAGE}
      </span>
      <Button
        type="button"
        variant="outline"
        onClick={copyMessage}
        className="h-auto min-h-11 rounded-full border-[#eaeaea] bg-white px-3 py-2.5 text-xs text-[#202020] shadow-none hover:bg-[#f6f6f6] focus-visible:ring-neutral-400 sm:text-[13px]"
      >
        {copyState === "copied" ? (
          <Check className="hidden sm:block" aria-hidden="true" />
        ) : (
          <Copy className="hidden sm:block" aria-hidden="true" />
        )}
        {copyState === "copied" ? "已複製" : copyState === "manual" ? "長按複製" : "複製文字"}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {copyState === "copied"
          ? "已複製「已完成綁定」。"
          : copyState === "manual"
            ? "請長按已選取的文字並複製，或直接在官方 LINE 聊天室輸入「已完成綁定」。"
            : ""}
      </span>
    </div>
  );
}
