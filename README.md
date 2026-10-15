# minichi_Line_Login

這個資料夾是 MINICHI 的公開 LINE Login／顧客綁定入口。它負責讓客人完成 LINE 官方登入、驗證 LINE 身分，並依社群暱稱是否撞名決定自動綁定或送進待審核資料；管理員的撞名審核與正式資料異動仍由 [`minichi_admin_system`](../minichi_admin_system/) 負責。

## 責任邊界

本服務可以：

- 顯示 `/line-register` 綁定入口。
- 使用 LINE Login OAuth 2.1、PKCE、state、nonce 與官方 ID token verify endpoint。
- 呼叫管理員 migration 提供的受限 `SECURITY DEFINER` ingress RPC。
- 當客人輸入的社群暱稱與目前有效社群暱稱沒有重複時，由 RPC 在同一個短 transaction 建立顧客、社群暱稱 alias、active LINE identity，並將 request 標為 `auto_approved`。
- 當社群暱稱撞名時，建立 `staging.customer_identity_binding_requests` 的 `pending` 申請，交由管理員處理。
- 讓重複登入可以回傳已綁定或重用未過期申請的狀態。
- LINE Login 回傳的 display name 只保存為 snapshot／內部參考，不參與重複判斷，也不建立 display-name 唯一性。

本服務不可以：

- 直接新增或修改 `main.customers`、`main.customer_aliases` 或 `main.customer_contact_identities`；若無撞名，這些異動只能由資料庫內的 bounded RPC 原子完成。
- 審核、拒絕或直接通過綁定申請。
- 在 RPC 以外自行決定候選顧客或任意寫入顧客欄位。
- 讀取訂單、付款、結帳或管理員資料。
- 使用 `SUPABASE_SERVICE_ROLE_KEY` 或管理員系統使用的完整資料庫連線。

## 實際流程

1. 客人在 `/line-register` 填寫社群名稱，點擊「閱讀購前說明並繼續」。
2. 公開頁開啟可滾動的購前說明；滑到內容最底部後，才可勾選同意，再點擊「同意並前往 LINE」。
3. 服務確認表單帶有購前說明同意值後，建立短期、加密的 OAuth transaction cookie，導向 LINE Login。
4. LINE callback 回來後，服務交換 authorization code，並向 LINE 官方 verify endpoint 驗證 ID token、issuer、audience、expiry 與 nonce。
5. 驗證成功後，RPC 只用客人輸入的社群暱稱比對目前有效的 `line_community_name`；LINE display name 不參與比對。
6. 無同名時，RPC 同交易建立顧客、唯一 current community alias、active LINE identity，並回傳 `bound`／`auto_approved`。
7. 撞名時建立 `pending` 申請；同一個 LINE subject 的未過期申請會被重用，管理員在 `minichi_admin_system/identity-bindings` 處理。
8. 綁定成功或重複登入的 `bound` 結果頁引導客人複製「已完成綁定」，透過使用者指定的 `https://line.me/R/ti/p/@903jhmgb` 連結回到官方 LINE，貼上文字並手動傳送。此步驟只調整頁面引導，不新增資料庫綁定狀態或改變 pending 審核。
9. 後續自動結帳訊息流程以已綁定的 active LINE identity 為基礎實作。

綁定成功後，資料庫 trigger 會在同一個 transaction 寫入
`integration.line_binding_admin_email_outbox`；公開 LINE Login 服務不持有 Email
provider secret，也不等待 Email 發送完成。Supabase Edge Function 會另外領取
outbox，寄送一封通知到管理員 Gmail，並記錄重試／失敗狀態。待審核申請不寄 Email。

## Route

| Route | 用途 |
| --- | --- |
| `/` | 導向 `/line-register` |
| `/line-register` | 客人閱讀購前說明、填寫社群名稱並開始 LINE Login |
| `/line-register/result` | 綁定成功時引導回官方 LINE 傳送訊息；其餘顯示待審核或錯誤結果 |
| `POST /api/line-login/start` | 建立 OAuth transaction 並導向 LINE |
| `GET /api/line-login/callback` | 處理 LINE callback 並依社群暱稱結果自動綁定或建立待審核申請 |
| `POST /api/line-binding-requests` | 給其他受控入口使用的 ID token 綁定 API |
| `GET /api/health` | 回報服務與必要設定狀態，不連線執行資料異動 |

## 環境變數

先參考 [`.env.example`](./.env.example) 的內容填寫本機 `.env`，再填入敏感資料。此資料夾已將 `.env` 加入 gitignore；部署平台的 secrets 也應使用同一組變數名稱。

最重要的是：`MINICHI_LINE_LOGIN_DB_URL` 必須指向專門給此服務的 least-privilege database role。不要填入管理員系統的 `SUPABASE_DB_URL`，也不要把 `SUPABASE_SERVICE_ROLE_KEY` 放進這個服務。公開 role 應只被授予下方 private ingress RPC 的 schema `USAGE` 與 function `EXECUTE` 權限，不應直接拿到 customer、identity 或 order table 的權限。

在正式環境前，仍要由資料庫 migration／權限設定明確落實以下限制：

- 將 `minichi_admin_system/supabase/migrations/0020_line_login_ingress_rpc.sql` 與
  `0021_line_login_auto_approval.sql` 按順序套用到同一個資料庫。
- 只對公開資料庫 role 授予 `private` schema 的 `USAGE`，以及
  `private.submit_line_binding_request(text, text, text, text, text, integer)` 的 `EXECUTE`。
- 由該 `SECURITY DEFINER` RPC 在資料庫內完成 subject idempotency、pending reuse／expiry、目前社群暱稱撞名判斷、無撞名自動建立與 requested／customer_created／auto_approved audit；公開 role 不直接讀寫任何 business table。
- 拒絕 `main.customers`、`main.customer_aliases`、訂單、付款與管理員資料的讀取或寫入。
- 部署前確認 RPC owner、`search_path = pg_catalog`、RLS 與 execute grant；不要用 `BYPASSRLS` 或管理員 role 代替。

例如由資料庫 owner／migration operator 建立公開 app 的 login role 後，只授權：

```sql
grant usage on schema private to minichi_line_login_app;

grant execute on function private.submit_line_binding_request(
  text, text, text, text, text, integer
) to minichi_line_login_app;
```

## 本機指令

```bash
npm install
npm run dev
npm test
npm run build
```

預設本機網址是 `http://localhost:4300/line-register`。LINE Login Console 的 callback URL 必須與 `MINICHI_LINE_LOGIN_CALLBACK_URL` 完全一致；正式環境必須使用 HTTPS。

## 部署原則

這個入口是給客人使用的，因此正式使用時需要部署到可由客人開啟的 HTTPS 網址；「不公開部署」只適用於管理員系統，不適用於這個登入入口。管理員系統可以使用另一個受保護的網址，兩者共用資料庫 schema，但使用不同的應用程式與資料庫權限。

目前資料庫 schema migration 仍由 `minichi_admin_system/supabase/migrations/` 管理；本服務只消費受限的 private ingress contract，不在公開 app 內複製管理員 schema。
