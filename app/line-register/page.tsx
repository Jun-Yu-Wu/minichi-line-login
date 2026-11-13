import { AlertCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import config from "../../src/server/config";
import LineLoginForm from "./LineLoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description: "使用 LINE 連結小日辰會員身分。",
  title: "小日辰會員綁定｜MINICHI",
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_alias: "請先填寫 1–20 字的 LINE 社群名稱，再點擊登入。",
  csrf_token_invalid: "安全登入連結已失效，請重新整理頁面後再試。",
  login_start_failed: "目前無法進行 LINE 登入，請稍後再試。",
  not_configured: "LINE 登入服務尚未開放。",
  purchase_notice_required: "請先閱讀並同意購前說明，再前往 LINE 登入。",
  rate_limited: "嘗試次數過多，請稍後再試。",
  request_too_large: "送出的資料過大，請重新填寫。",
};

export default async function LineRegisterPage({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const configured = config.isLineLoginWebConfigured();
  const message = error ? ERROR_MESSAGES[error] || ERROR_MESSAGES.login_start_failed : "";

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex h-16 w-full max-w-[70rem] items-center px-4 sm:px-6">
          <Link className="flex min-h-11 items-center gap-2 text-sm font-semibold text-foreground" href="/line-register">
            <span>小日辰</span>
            <span className="text-xs font-normal tracking-[0.08em] text-muted-foreground">MINICHI</span>
          </Link>
        </div>
      </header>

      <main className="page-enter grid min-h-[calc(100svh-4rem)] place-items-center px-4 py-10 sm:px-6 sm:py-14">
        <Card className="w-full max-w-[35rem] gap-0 rounded-2xl border-border bg-card px-6 py-8 shadow-none sm:px-9 sm:py-10">
          <h1 className="text-2xl font-semibold leading-[1.3] text-foreground sm:text-[28px]">
            開始會員綁定
          </h1>

          {message || !configured ? (
            <Alert className="mt-6 rounded-lg" variant="destructive">
              <AlertCircle className="size-4" aria-hidden="true" />
              <AlertDescription>{message || ERROR_MESSAGES.not_configured}</AlertDescription>
            </Alert>
          ) : null}

          <LineLoginForm configured={configured} />
        </Card>
      </main>
    </div>
  );
}
