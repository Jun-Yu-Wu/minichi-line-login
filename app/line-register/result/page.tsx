import Link from "next/link";
import { ArrowRight, CircleAlert, Clock3, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import BindingMessage from "./BindingMessage";

export const dynamic = "force-dynamic";

const RESULTS = {
  pending: {
    description: "申請已送出，等待管理員確認",
    icon: Clock3,
    title: "申請已送出",
    tone: "bg-sky/25 text-ink",
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

  if (result === "bound") {
    const chatUrl = "https://line.me/R/ti/p/@903jhmgb";

    return (
      <main className="page-enter flex min-h-svh items-center justify-center bg-white px-4 py-8 sm:px-6 sm:py-12">
        <Card className="w-full max-w-[26rem] gap-0 rounded-[1.625rem] border-[#eaeaea] bg-white px-5 pb-6 pt-11 text-left shadow-[0_12px_36px_#00000008] sm:px-8 sm:pb-8 sm:pt-14">
          <h1 className="flex items-center gap-3 text-[29px] font-semibold leading-[1.34] tracking-[-0.035em] text-[#202020] sm:text-[32px]">
            <CircleAlert className="size-8 shrink-0 stroke-[1.75] sm:size-9" aria-hidden="true" />
            <span>最後一步</span>
          </h1>
          <p className="mb-8 mt-5 text-base leading-[1.8] text-[#646464]">
            複製以下文字，<br />
            傳送到官方 LINE 聊天室。
          </p>
          <BindingMessage />
          <Button asChild className="mt-12 h-auto min-h-14 w-full justify-between rounded-xl bg-[#202020] px-4 py-4 text-[15px] text-white shadow-none hover:bg-[#333333] focus-visible:ring-neutral-400 sm:mt-16 sm:px-5 sm:text-base [&_svg]:size-5">
            <a href={chatUrl}>
              打開官方 LINE 聊天室
              <ArrowRight aria-hidden="true" />
            </a>
          </Button>
        </Card>
      </main>
    );
  }

  const success = RESULTS[result as keyof typeof RESULTS];
  const Icon = success?.icon || CircleAlert;

  return (
    <main className="page-enter flex min-h-dvh items-center justify-center px-6 py-8">
      <section className="flex w-full max-w-[22rem] flex-col items-center text-center">
        <div className={`grid size-20 place-items-center rounded-[1.75rem] ${success?.tone || "bg-sky/25 text-ink"}`}>
          <Icon className="size-9" aria-hidden="true" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-[-0.04em] text-ink sm:text-3xl">{success?.title || "尚未完成綁定"}</h1>
        <p className="mt-2 text-sm leading-6 text-ink/65">
          {success?.description || ERROR_MESSAGES[result] || ERROR_MESSAGES.callback_failed}
        </p>
        {!success ? (
          <Button asChild className="mt-7 min-h-11 rounded-xl bg-blue px-5 text-white shadow-none hover:bg-ink">
            <Link href="/line-register">
              重新開始
              <RotateCcw aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </section>
    </main>
  );
}
