"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LineLoginForm({ configured }: { configured: boolean }) {
  const [csrfToken, setCsrfToken] = useState("");
  const [csrfUnavailable, setCsrfUnavailable] = useState(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [hasAcceptedNotice, setHasAcceptedNotice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const noticeScrollRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const noticeTriggerRef = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!configured) return;
    const controller = new AbortController();
    fetch("/api/line-login/start-token", {
      cache: "no-store",
      credentials: "same-origin",
      method: "POST",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("token_unavailable");
        const payload = await response.json() as { csrfToken?: unknown };
        if (typeof payload.csrfToken !== "string") throw new Error("token_unavailable");
        setCsrfToken(payload.csrfToken);
        setCsrfUnavailable(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setCsrfUnavailable(true);
      });
    return () => controller.abort();
  }, [configured]);

  useEffect(() => {
    if (!isNoticeOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();
    if (noticeScrollRef.current) noticeScrollRef.current.scrollTop = 0;

    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [isNoticeOpen]);

  function closeNotice() {
    if (dialogRef.current?.open) dialogRef.current.close();
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

    if (element.scrollHeight - element.scrollTop - element.clientHeight <= 12) {
      setHasReachedEnd(true);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (
      !configured
      || submittingRef.current
      || !csrfToken
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
      className="mt-7 grid gap-5"
      ref={formRef}
      method="post"
      onSubmit={handleSubmit}
    >
      <div className="grid gap-2.5">
        <Label className="text-sm font-medium text-foreground" htmlFor="claimedAlias">
          LINE 社群暱稱
        </Label>
        <Input
          aria-describedby="claimedAlias-help"
          autoComplete="nickname"
          className="h-12 rounded-lg border-input bg-white px-3.5 text-base text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 md:text-base"
          id="claimedAlias"
          maxLength={20}
          name="claimedAlias"
          placeholder="例如：小頓"
          readOnly={isSubmitting}
          required
        />
        <span className="sr-only" id="claimedAlias-help">
          請輸入 20 字以內的 LINE 社群暱稱。
        </span>
      </div>
      <input
        name="purchaseNoticeAccepted"
        type="hidden"
        value={hasAcceptedNotice ? "accepted" : ""}
      />
      <input name="csrfToken" type="hidden" value={csrfToken} />
      {csrfUnavailable ? (
        <p className="text-sm leading-6 text-destructive" role="status">
          目前無法建立安全登入，請重新整理頁面或稍後再試。
        </p>
      ) : null}
      <Button
        className="min-h-12 w-full rounded-lg bg-primary px-5 text-base font-medium text-primary-foreground shadow-none hover:bg-[#333333] active:bg-[#111111] focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted disabled:text-muted-foreground"
        disabled={!configured || isSubmitting}
        onClick={handleOpenNotice}
        ref={noticeTriggerRef}
        type="button"
      >
        <span>閱讀購前說明並繼續</span>
        <ArrowRight aria-hidden="true" />
      </Button>

      {isNoticeOpen ? (
        <dialog
          aria-labelledby="purchase-notice-title"
          className="purchase-notice-dialog fixed inset-x-0 bottom-0 m-0 flex h-[92dvh] max-h-[92dvh] w-full max-w-none flex-col overflow-hidden rounded-t-2xl border-0 bg-white p-0 text-foreground shadow-[0_8px_24px_rgb(0_0_0_/_10%)] outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:h-[90dvh] sm:max-h-[90dvh] sm:w-[calc(100vw-2.5rem)] sm:max-w-[40rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
          onCancel={(event) => {
            event.preventDefault();
            closeNotice();
          }}
          ref={dialogRef}
        >
          <header className="flex shrink-0 items-center border-b border-border px-5 py-4 sm:px-7 sm:py-5">
            <h2 className="text-xl font-semibold leading-[1.35] text-foreground sm:text-2xl" id="purchase-notice-title">
              購前說明
            </h2>
          </header>

          <div
            aria-label="購前說明內容"
            className="purchase-notice-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 text-sm leading-7 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-7"
            onScroll={handleNoticeScroll}
            ref={noticeScrollRef}
            role="region"
            tabIndex={0}
          >
            <div className="grid gap-8 pb-3">
              <NoticeGroup title="社群大守則">
                <ol className="grid list-decimal gap-2 pl-5 marker:text-muted-foreground">
                  <li>閱讀以下內容即同意本社群之規定</li>
                  <li>
                    加入官方 LINE 進行綁定：<span className="font-semibold text-foreground">@903jhmgb</span>（有 @）
                  </li>
                </ol>
                <p className="mt-4 rounded-lg bg-muted px-3.5 py-3 font-semibold text-foreground">
                  未綁定者不得喊單！
                </p>
              </NoticeGroup>

              <NoticeGroup title="喊單規則">
                <ol className="grid list-decimal gap-2 pl-5 marker:text-muted-foreground">
                  <li>請於「社群內喊單」避免遺漏即時訊息！</li>
                  <li>避免洗版請利用聊天串功能！</li>
                  <li>喊單後請回傳商品照 &amp; 數量到官方～</li>
                </ol>
              </NoticeGroup>

              <NoticeGroup title="商品價格 &amp; 訂金">
                <ol className="grid list-decimal gap-3 pl-5 marker:text-muted-foreground">
                  <li>以「台幣」直接報價！</li>
                  <li>
                    <div className="grid gap-2">
                      <p>結帳方法（滿 1000 元才需要匯款）</p>
                      <ul className="grid list-disc gap-1 pl-5 marker:text-muted-foreground">
                        <li>親飛連線：每日結單</li>
                        <li>小幫手連線 &amp; 預購：每週結帳</li>
                      </ul>
                    </div>
                  </li>
                </ol>
                <ul className="mt-4 grid list-disc gap-2 pl-5 marker:text-muted-foreground">
                  <li>請於匯款通知後的 24 小時內完成匯款</li>
                  <li>匯款完成後請主動告知「金額 + 帳號後五碼」</li>
                </ul>
                <div className="mt-5 grid gap-2">
                  <p className="font-semibold text-foreground">集點卡</p>
                  <ul className="grid list-disc gap-1 pl-5 marker:text-muted-foreground">
                    <li>單日結帳金額需大於面值金額方可使用</li>
                    <li>一日只能使用一張</li>
                    <li>除親飛連線外，其他商品一律不適用集點活動</li>
                    <li>（小幫手連線、預購、現貨等皆不適用）</li>
                  </ul>
                </div>
              </NoticeGroup>

              <NoticeGroup title="出貨、退換貨 &amp; 其他">
                <ol className="grid list-decimal gap-4 pl-5 marker:text-muted-foreground">
                  <li>
                    <div className="grid gap-2">
                      <p className="font-semibold text-foreground">拜託千萬不要棄單不領貨⋯哭</p>
                      <p>若有急單或保留單等可私訊官方帳號討論～</p>
                      <ul className="grid list-disc gap-1 pl-5 marker:text-muted-foreground">
                        <li>配送方式：7-11 賣貨便，運費 38 元</li>
                        <li>未取貨者將不再提供貨到付款</li>
                        <li>未取貨再次寄出需額外負擔 38 元作業費</li>
                      </ul>
                    </div>
                  </li>
                  <li>連線購買商品前都會拍圖確認！購買後就不予退/換貨！若確定購買但未能及時確認商品會直接採買，亦無法退換貨！</li>
                  <li>官網預購/扭蛋/盲盒等無法確認內容物商品，皆默認廠損（瑕），且不留殼（盒），亦不予退/換貨！</li>
                  <li>若為闆人為損傷商品，會主動告知處理～</li>
                </ol>
              </NoticeGroup>

              <div className="grid gap-2 border-t border-border pt-5">
                <p>以上！若有未盡事宜以我方為主</p>
                <p>也歡迎大家私訊官方詢問～</p>
                <p className="font-semibold text-foreground">大家購物愉快！</p>
                <p className="text-xs text-muted-foreground">更新：115.05.17</p>
              </div>
            </div>
          </div>

          <footer className="shrink-0 border-t border-border bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-7 sm:pb-5">
            <label className={`flex min-h-12 items-start gap-3 rounded-lg border px-3.5 py-3 text-sm leading-6 transition-colors ${hasReachedEnd ? "border-input bg-white text-foreground" : "border-border bg-muted text-muted-foreground"}`}>
              <input
                checked={hasAcceptedNotice}
                className="mt-1 size-4 shrink-0 accent-[#202020] disabled:cursor-not-allowed"
                disabled={!hasReachedEnd || isSubmitting}
                onChange={(event) => setHasAcceptedNotice(event.target.checked)}
                type="checkbox"
              />
              <span aria-live="polite">
                {hasReachedEnd ? "我已閱讀並同意購前說明" : "請先滑到說明底部，再勾選同意"}
              </span>
            </label>
            <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-3">
              <Button
                className="order-2 min-h-12 rounded-lg px-4 text-sm font-medium text-foreground shadow-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:order-1"
                onClick={closeNotice}
                type="button"
                variant="outline"
              >
                返回修改
              </Button>
              <Button
                className="order-1 min-h-12 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-none hover:bg-[#333333] active:bg-[#111111] focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted disabled:text-muted-foreground sm:order-2"
                disabled={!configured || !csrfToken || isSubmitting || !hasReachedEnd || !hasAcceptedNotice}
                type="submit"
              >
                <span>{isSubmitting ? "正在前往 LINE…" : "同意並前往 LINE"}</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </footer>
        </dialog>
      ) : null}
    </form>
  );
}

function NoticeGroup({ title, children }: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <h3 className="border-b border-border pb-2 text-base font-semibold leading-6 text-foreground">{title}</h3>
      <div>{children}</div>
    </section>
  );
}
