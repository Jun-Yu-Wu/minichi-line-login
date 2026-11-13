import Link from "next/link";
import { ArrowRight, CircleAlert, Clock3, MessageCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BINDING_MESSAGE } from "./message";

import BindingMessage from "./BindingMessage";

export const dynamic = "force-dynamic";

const RESULTS = {
  pending: {
    description: "等待管理員確認",
    icon: Clock3,
    title: "申請已送出",
  },
} as const;

const ERROR_MESSAGES: Record<string, string> = {
  binding_failed: "目前無法建立綁定申請，請稍後再試。",
  callback_failed: "LINE 登入回傳處理失敗，請重新開始。",
  denied: "你已取消 LINE 授權，尚未送出綁定申請。",
  login_invalid: "LINE 登入資料無效或已過期，請重新開始。",
  not_configured: "LINE 登入服務尚未完成設定。",
  request_conflict: "另一筆綁定申請正在處理，請稍後再試。",
  session_expired: "登入階段已過期或驗證狀態不一致，請重新開始。",
  temporarily_unavailable: "LINE 登入服務暫時無法連線，請稍後再試。",
};

export default async function LineRegisterResultPage({ searchParams }: {
  searchParams: Promise<{ result?: string }>;
}) {
  const { result = "callback_failed" } = await searchParams;
  const success = RESULTS[result as keyof typeof RESULTS];
  const isBound = result === "bound";
  const Icon = isBound ? MessageCircle : success?.icon || CircleAlert;
  const title = isBound ? "最後一步" : success?.title || "尚未完成綁定";
  const description = isBound
    ? "開啟官方 LINE 聊天室，送出已填入的文字。"
    : success?.description || ERROR_MESSAGES[result] || ERROR_MESSAGES.callback_failed;
  const iconTone = isBound || success ? "text-foreground" : "text-destructive";
  const officialLineId = encodeURIComponent("@903jhmgb");
  const message = encodeURIComponent(BINDING_MESSAGE);
  const chatUrl = `https://line.me/R/oaMessage/${officialLineId}/?${message}`;

  return (
    <main className="page-enter grid min-h-svh place-items-center bg-background px-4 py-8 sm:px-6 sm:py-12">
      <Card className="w-full max-w-[27.5rem] gap-0 rounded-2xl border-border bg-card px-5 py-8 shadow-none sm:px-8 sm:py-10">
        <h1 className="flex items-center gap-3 text-2xl font-semibold leading-[1.3] text-foreground sm:text-[28px]">
          <Icon className={`size-8 shrink-0 stroke-[1.75] ${iconTone}`} aria-hidden="true" />
          <span>{title}</span>
        </h1>
        <p className="mt-5 text-base leading-[1.7] text-muted-foreground">
          {description}
        </p>
        {isBound ? (
          <>
            <BindingMessage />
            <Button asChild className="mt-8 h-auto min-h-14 w-full justify-between rounded-lg bg-primary px-4 py-4 text-base text-primary-foreground shadow-none hover:bg-[#333333] active:bg-[#111111] focus-visible:ring-2 focus-visible:ring-ring sm:px-5">
              <a href={chatUrl}>
                打開官方 LINE 聊天室
                <ArrowRight aria-hidden="true" />
              </a>
            </Button>
          </>
        ) : null}
        {!success && !isBound ? (
          <Button asChild className="mt-7 min-h-12 w-full rounded-lg bg-primary px-5 text-base text-primary-foreground shadow-none hover:bg-[#333333] active:bg-[#111111] focus-visible:ring-2 focus-visible:ring-ring">
            <Link href="/line-register">
              重新開始
              <RotateCcw aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </Card>
    </main>
  );
}
