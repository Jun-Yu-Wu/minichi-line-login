"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import {
  ArrowRight,
  Check,
  FileText,
  LockKeyhole,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LineLoginForm({ configured }: { configured: boolean }) {
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [hasAcceptedNotice, setHasAcceptedNotice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const noticeScrollRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const noticeTriggerRef = useRef<HTMLButtonElement>(null);
  const wasNoticeOpenRef = useRef(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!isNoticeOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.focus();
      if (noticeScrollRef.current) noticeScrollRef.current.scrollTop = 0;
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeNotice();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isNoticeOpen]);

  useEffect(() => {
    if (isNoticeOpen) {
      wasNoticeOpenRef.current = true;
      return;
    }
    if (wasNoticeOpenRef.current) {
      wasNoticeOpenRef.current = false;
      noticeTriggerRef.current?.focus();
    }
  }, [isNoticeOpen]);

  function closeNotice() {
    setIsNoticeOpen(false);
    setHasReachedEnd(false);
    setHasAcceptedNotice(false);
  }

  function handleOpenNotice() {
    if (!configured || isSubmitting) return;

    if (!formRef.current?.reportValidity()) return;

    setHasReachedEnd(false);
    setHasAcceptedNotice(false);
    setIsNoticeOpen(true);
  }

  function handleNoticeScroll() {
    const element = noticeScrollRef.current;
    if (!element) return;

    const isAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight <= 12;
    if (isAtBottom) setHasReachedEnd(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (
      !configured
      || submittingRef.current
      || !hasReachedEnd
      || !hasAcceptedNotice
    ) {
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
      ref={formRef}
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
      <input
        name="purchaseNoticeAccepted"
        type="hidden"
        value={hasAcceptedNotice ? "accepted" : ""}
      />
      <Button
        className="min-h-[3.25rem] w-full rounded-xl bg-blue px-5 text-[0.95rem] font-semibold text-white shadow-[0_14px_28px_-18px_var(--ink)] transition-[background-color,transform,box-shadow] duration-200 hover:bg-ink hover:shadow-[0_16px_30px_-18px_var(--ink)] active:translate-y-px focus-visible:ring-4 focus-visible:ring-sky/30 disabled:bg-ink/20 disabled:text-ink/45 disabled:shadow-none lg:min-h-14"
        disabled={!configured || isSubmitting}
        onClick={handleOpenNotice}
        ref={noticeTriggerRef}
        type="button"
      >
        <FileText className="size-4" aria-hidden="true" />
        <span>{hasAcceptedNotice ? "前往 LINE 官方登入" : "閱讀購前說明並繼續"}</span>
        <ArrowRight aria-hidden="true" />
      </Button>

      {isNoticeOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-5">
          <div aria-hidden="true" className="absolute inset-0 bg-ink/60 backdrop-blur-[3px]" />
          <div
            aria-labelledby="purchase-notice-title"
            aria-modal="true"
            className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-ink/10 bg-white shadow-[0_28px_80px_-28px_var(--ink)] outline-none sm:max-w-[40rem] sm:rounded-[1.75rem]"
            ref={dialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <header className="flex shrink-0 items-start justify-between gap-5 border-b border-ink/10 px-5 pb-4 pt-5 sm:px-7 sm:pb-5 sm:pt-6">
              <div>
                <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-blue">
                  <span className="grid size-5 place-items-center rounded-md bg-cyan/70 text-ink">
                    <FileText className="size-3" aria-hidden="true" />
                  </span>
                  Before you continue
                </div>
                <h2 className="display-type mt-3 text-[1.55rem] font-semibold leading-tight tracking-[-0.045em] text-ink sm:text-[1.8rem]" id="purchase-notice-title">
                  開始綁定前，請先閱讀購前說明
                </h2>
              </div>
              <button
                aria-label="關閉購前說明"
                className="grid size-10 shrink-0 place-items-center rounded-xl text-ink/55 transition-colors hover:bg-ice/70 hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/30"
                onClick={closeNotice}
                type="button"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </header>

            <div
              aria-label="購前說明內容"
              className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sky/25 sm:px-7 sm:py-6"
              onScroll={handleNoticeScroll}
              ref={noticeScrollRef}
              role="region"
              tabIndex={0}
            >
              <div className="grid gap-7 pb-3 text-[13px] leading-6 text-ink/75 sm:text-sm sm:leading-7">
                <p className="display-type border-b border-ink/10 pb-5 text-lg font-semibold tracking-[-0.03em] text-ink sm:text-xl">
                  【小日辰購前說明】
                </p>

                <NoticeGroup title="🚨 社群大守則">
                  <div className="grid gap-2.5">
                    <p><span className="mr-2">1️⃣</span>閱讀以下內容即同意本社群之規定</p>
                    <p>
                      <span className="mr-2">2️⃣</span>
                      加入官方 LINE 進行綁定：<span className="font-mono font-semibold tracking-[0.04em] text-blue">@903jhmgb</span>（有 @）
                    </p>
                  </div>
                  <p className="mt-4 rounded-xl border border-blue/15 bg-cyan/25 px-3.5 py-3 font-semibold text-ink">
                    💡 未綁定者不得喊單！
                  </p>
                </NoticeGroup>

                <NoticeGroup title="｜喊單規則">
                  <div className="grid gap-3">
                    <p><span className="mr-2">1️⃣</span>請於「社群內喊單」避免遺漏即時訊息！</p>
                    <p><span className="mr-2">2️⃣</span>避免洗版請利用聊天串功能！</p>
                    <p><span className="mr-2">3️⃣</span>喊單後請回傳商品照 &amp; 數量到官方～</p>
                  </div>
                </NoticeGroup>

                <NoticeGroup title="｜商品價格 & 訂金">
                  <div className="grid gap-4">
                    <p><span className="mr-2">1️⃣</span>以「台幣」直接報價！</p>
                    <div>
                      <p><span className="mr-2">2️⃣</span>結帳方法（滿 1000 元才需要匯款）</p>
                      <div className="mt-2 grid gap-1.5 text-ink/65">
                        <p>🍵 親飛連線 ➡️ 每日結單</p>
                        <p>小幫手連線 &amp; 預購 ➡️ 每週結帳</p>
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <p>☁️ 請於匯款通知後的 24 小時內完成匯款</p>
                      <p>☁️ 匯款完成後請主動告知「金額 + 帳號後五碼」</p>
                    </div>
                    <div>
                      <p className="font-semibold text-ink">💡 集點卡</p>
                      <div className="mt-2 grid gap-1.5 text-ink/65">
                        <p>💡 單日結帳金額需大於面值金額方可使用</p>
                        <p>💡 一日只能使用一張</p>
                        <p>💡 除親飛連線外，其他商品一律不適用集點活動</p>
                        <p>（小幫手連線、預購、現貨等皆不適用）</p>
                      </div>
                    </div>
                  </div>
                </NoticeGroup>

                <NoticeGroup title="｜出貨、退換貨 & 其他">
                  <div className="grid gap-4">
                    <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-ink/75">
                      <p className="font-semibold text-destructive">1️⃣ 拜託千萬不要棄單不領貨⋯哭 😣</p>
                      <p className="mt-2">若有急單或保留單等可私訊官方帳號討論～</p>
                      <p className="mt-2 border-t border-destructive/15 pt-2">— 配送方式：7-11 賣貨便，運費 38 元</p>
                      <p className="mt-1.5">☁️ 未取貨者將不再提供貨到付款</p>
                      <p className="mt-1.5">☁️ 未取貨再次寄出需額外負擔 38 元作業費</p>
                    </div>
                    <p>
                      2️⃣ 連線購買商品前都會拍圖確認！購買後就不予退/換貨！若確定購買但未能及時確認商品會直接採買，亦無法退換貨！
                    </p>
                    <p>
                      3️⃣ 官網預購/扭蛋/盲盒等無法確認內容物商品，皆默認廠損（瑕），且不留殼（盒），亦不予退/換貨！
                    </p>
                    <p><span className="mr-2">4️⃣</span>若為闆人為損傷商品，會主動告知處理～</p>
                  </div>
                </NoticeGroup>

                <div className="text-ink/75">
                  <p>以上！若有未盡事宜以我方為主</p>
                  <p className="mt-1">也歡迎大家私訊官方詢問～</p>
                  <p className="mt-3 font-semibold text-ink">㊗️ 大家購物愉快！</p>
                  <p className="mt-3 font-mono text-[10px] tracking-[0.08em] text-ink/50">更新：115.05.17</p>
                </div>

                <div className="flex items-start gap-3 text-ink/70">
                  <LockKeyhole className="mt-1 size-4 shrink-0 text-blue" aria-hidden="true" />
                  <p className="text-[12px] leading-5 text-ink/70 sm:text-[13px] sm:leading-6">
                    讀完後，請勾選「我已閱讀並同意上述購前說明」。完成同意後，才會前往 LINE 官方登入頁面。
                  </p>
                </div>
              </div>
            </div>

            <footer className="shrink-0 border-t border-ink/10 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-7 sm:pb-5 sm:pt-5">
              <label className={`flex min-h-12 items-start gap-3 rounded-xl border px-3.5 py-3 text-[13px] leading-5 transition-colors sm:text-sm ${hasReachedEnd ? "border-blue/25 bg-cyan/20 text-ink" : "border-ink/10 bg-ink/[0.03] text-ink/40"}`}>
                <input
                  checked={hasAcceptedNotice}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--blue)] disabled:cursor-not-allowed"
                  disabled={!hasReachedEnd || isSubmitting}
                  onChange={(event) => setHasAcceptedNotice(event.target.checked)}
                  type="checkbox"
                />
                <span>我已閱讀並同意上述購前說明</span>
              </label>
              <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-3">
                <Button
                  className="order-2 min-h-12 rounded-xl px-4 text-sm font-medium text-ink/65 hover:bg-ice/60 hover:text-ink focus-visible:ring-4 focus-visible:ring-sky/30 sm:order-1"
                  onClick={closeNotice}
                  type="button"
                  variant="ghost"
                >
                  返回修改
                </Button>
                <Button
                  className="order-1 min-h-12 rounded-xl bg-blue px-5 text-sm font-semibold text-white shadow-[0_14px_28px_-18px_var(--ink)] transition-[background-color,transform,box-shadow] duration-200 hover:bg-ink hover:shadow-[0_16px_30px_-18px_var(--ink)] active:translate-y-px focus-visible:ring-4 focus-visible:ring-sky/30 disabled:bg-ink/15 disabled:text-ink/35 disabled:shadow-none sm:order-2"
                  disabled={!configured || isSubmitting || !hasReachedEnd || !hasAcceptedNotice}
                  type="submit"
                >
                  <span>{isSubmitting ? "正在前往 LINE…" : "同意並前往 LINE"}</span>
                  {isSubmitting ? <Check className="size-4" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}
                </Button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function NoticeGroup({ title, children }: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-2.5">
      <h3 className="border-l-2 border-blue/55 pl-3 text-sm font-semibold leading-6 text-ink sm:text-[15px]">{title}</h3>
      <div>{children}</div>
    </section>
  );
}
