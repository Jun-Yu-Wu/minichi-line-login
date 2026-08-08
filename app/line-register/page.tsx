import { AlertCircle, LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import config from "../../src/server/config";
import LineLoginForm from "./LineLoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description: "使用 LINE Login 連結小日辰顧客身分。",
  title: "小日辰 LINE 官方綁定｜MINICHI",
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_alias: "請先填寫 1–20 字的 LINE 社群名稱，再點擊登入。",
  login_start_failed: "目前無法進行 LINE 登入，請稍後再試。",
  not_configured: "LINE 登入服務尚未開放。",
  purchase_notice_required: "請先閱讀並同意購前說明，再前往 LINE 登入。",
  request_too_large: "送出的資料過大，請重新填寫。",
};

export default async function LineRegisterPage({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const configured = config.isLineLoginWebConfigured();
  const message = error ? ERROR_MESSAGES[error] || ERROR_MESSAGES.login_start_failed : "";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-ink/10 bg-ice/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[74rem] items-center justify-between px-6 py-3.5 sm:px-8 sm:py-4">
          <Link className="group flex items-center gap-3" href="/line-register">
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-[0.7rem] bg-ink transition-transform duration-200 group-hover:-rotate-3"
            >
              <span className="grid gap-1">
                <span className="h-1 w-3.5 rounded-full bg-white" />
                <span className="h-1 w-2.5 rounded-full bg-cyan" />
              </span>
            </span>
            <span>
              <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-ink/60">MINICHI</span>
              <span className="display-type hidden text-base font-semibold leading-tight text-ink sm:block">LINE 顧客連結</span>
            </span>
          </Link>
          <p className="hidden font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-ink/60 sm:block">官方Line綁定</p>
        </div>
      </header>

      <main className="page-enter mx-auto flex min-h-[calc(100dvh-4.25rem)] w-full max-w-[74rem] flex-1 items-center bg-white/35 px-6 py-8 sm:px-8 sm:py-10 lg:min-h-[calc(100dvh-8.25rem)] lg:bg-transparent lg:py-12">
        <Card className="grid w-full gap-0 overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none lg:overflow-hidden lg:rounded-[2rem] lg:border-ink/10 lg:bg-white lg:shadow-[0_28px_80px_-42px_var(--ink)] lg:grid-cols-[0.9fr_1.1fr]">
          <section className="relative isolate hidden min-h-0 flex-col justify-between overflow-hidden bg-ink px-6 py-5 text-white lg:flex lg:min-h-[35rem] lg:px-12 lg:py-12">
            <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-28 -z-10 size-80 rounded-full border border-cyan/20" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-12 -z-10 size-64 rounded-full bg-blue/35 blur-2xl" />
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan">MINICHI / LINE LOGIN</p>
              <h1 className="display-type mt-12 max-w-[9ch] text-[clamp(2.5rem,5vw,4.2rem)] font-semibold leading-[1.04] tracking-[-0.055em] [text-wrap:balance]">
                開始綁定官方Line
              </h1>
            </div>
            <div className="mt-12 flex items-center gap-3 border-t border-white/15 pt-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue font-mono text-xs font-semibold text-white">01</span>
              <div>
                <p className="text-sm font-medium">綁定流程</p>
                <p className="mt-1 text-xs leading-5 text-white/55">輸入社群暱稱，接著登入 LINE 綁定</p>
              </div>
            </div>
          </section>

          <section className="flex w-full items-center bg-transparent px-0 py-0 lg:min-h-[35rem] lg:bg-white lg:px-16 lg:py-12">
            <div className="mx-auto w-full max-w-[22rem] lg:max-w-[29rem]">
              <div className="hidden items-center justify-between font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-blue lg:flex">
                <span>顧客登入</span>
                <span className="text-ink/35">01 / 01</span>
              </div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-blue lg:hidden">LINE 官方綁定</p>
              <h1 className="mt-3 max-w-[18ch] text-[1.75rem] font-semibold leading-[1.22] tracking-[-0.045em] text-ink [text-wrap:balance] lg:hidden">
                請輸入你在小日辰社群中的暱稱
              </h1>
              <h2 className="mt-4 hidden text-2xl font-semibold tracking-[-0.04em] text-ink lg:mt-6 lg:block lg:text-4xl">輸入社群名稱</h2>
              <p className="mt-2 hidden max-w-[25rem] text-sm leading-6 text-ink/65 lg:mt-3 lg:block lg:leading-7">
                請填寫您在小日辰社群中的暱稱。
              </p>

              {message || !configured ? (
                <Alert className="mt-6 border-blue/25 bg-cyan/35 text-ink [&>svg]:text-blue lg:mt-7" variant="default">
                  <AlertCircle className="size-4" aria-hidden="true" />
                  <AlertDescription>{message || ERROR_MESSAGES.not_configured}</AlertDescription>
                </Alert>
              ) : null}

              <LineLoginForm configured={configured} />

              <div className="mt-4 flex items-start justify-center text-center text-[11px] leading-5 text-ink/55 lg:mt-7 lg:justify-start lg:border-t lg:border-ink/10 lg:pt-4 lg:text-left lg:text-xs">
                <LockKeyhole className="mt-0.5 hidden size-3.5 shrink-0 text-blue lg:mr-2.5 lg:block" aria-hidden="true" />
                <p>將在 LINE 官方頁面完成登入。</p>
              </div>
            </div>
          </section>
        </Card>
      </main>

      <footer className="mx-auto hidden w-full max-w-[74rem] items-center justify-between px-5 py-5 text-[11px] text-ink/65 sm:flex sm:px-8">
        <span>MINICHI 小日辰</span>
        <span>資料僅用於綁定與傳送通知</span>
      </footer>
    </div>
  );
}
