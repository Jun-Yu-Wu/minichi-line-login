import Link from "next/link";
import { Check, CircleAlert, Clock3, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const RESULTS = {
  bound: {
    description: "LINE 已完成綁定",
    icon: Check,
    title: "綁定成功",
    tone: "bg-cyan text-ink",
  },
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
