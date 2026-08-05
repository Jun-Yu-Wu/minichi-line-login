"use client";

import { FormEvent, useRef, useState } from "react";

import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LineLoginForm({ configured }: { configured: boolean }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!configured || submittingRef.current) {
      event.preventDefault();
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
  }

  return (
    <form
      action="/api/line-login/start"
      aria-busy={isSubmitting}
      className="mt-7 grid gap-4 lg:mt-5 lg:gap-5"
      method="post"
      onSubmit={handleSubmit}
    >
      <div className="grid gap-2.5">
        <Label className="sr-only text-sm font-medium text-ink lg:not-sr-only lg:flex lg:justify-between" htmlFor="claimedAlias">
          <span>小日辰 LINE 社群中的暱稱</span>
          <span className="font-mono text-[10px] font-normal tracking-[0.08em] text-ink/45">必填</span>
        </Label>
        <Input
          aria-describedby="claimedAlias-help"
          autoComplete="nickname"
          className="h-[3.25rem] rounded-xl border-blue/35 bg-white px-4 text-base text-ink shadow-[0_2px_0_0_var(--ice)] placeholder:text-ink/35 focus-visible:border-blue focus-visible:ring-4 focus-visible:ring-sky/25 lg:h-14"
          id="claimedAlias"
          maxLength={20}
          name="claimedAlias"
          placeholder="例如：小頓"
          readOnly={isSubmitting}
          required
        />
        <span className="sr-only" id="claimedAlias-help">請輸入 20 字以內的 LINE 社群暱稱。</span>
      </div>
      <Button
        className="min-h-[3.25rem] w-full rounded-xl bg-blue px-5 text-[0.95rem] font-semibold text-white shadow-[0_14px_28px_-18px_var(--ink)] transition-[background-color,transform,box-shadow] duration-200 hover:bg-ink hover:shadow-[0_16px_30px_-18px_var(--ink)] active:translate-y-px focus-visible:ring-4 focus-visible:ring-sky/30 disabled:bg-ink/20 disabled:text-ink/45 disabled:shadow-none lg:min-h-14"
        disabled={!configured || isSubmitting}
        type="submit"
      >
        <span className="lg:hidden">{isSubmitting ? "前往 LINE 中…" : "使用 LINE 登入"}</span>
        <span className="hidden lg:inline">{isSubmitting ? "正在前往 LINE…" : "前往 LINE 官方登入"}</span>
        <ArrowRight className="hidden lg:inline-flex" aria-hidden="true" />
      </Button>
    </form>
  );
}
