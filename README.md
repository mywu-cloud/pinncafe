# PiNNCafé 品咖啡 官網（www.pinncafe.com）

靜態網頁 + Cloudflare Pages Functions + D1 資料庫。豆單和網站設定都在**後台**修改，不用改程式碼。

## 平常怎麼用：後台

打開 **https://www.pinncafe.com/admin**，用你的 Google 帳號登入（Cloudflare Access，只有允許名單上的 email 能進）。

**豆單**
- **售完**：按「售完」，官網卡片標示「已售完」、訂購按鈕停用。
- **補貨**：按「補貨上架」，恢復可訂購。
- **下架／顯示**：暫時不放在官網（資料保留）。
- **編輯**：產地、產區、英文小字、風味、介紹、處理法、海拔、焙度、規格、售價、卡片顏色、照片。售價空白會顯示「價格請洽 LINE」。
- **照片**：在編輯視窗按「選擇照片」，會自動縮小到 1200px 再上傳。沒照片時卡片上方顯示等高線圖。iPhone 的 HEIC 照片請先轉 JPG（或在 iPhone 設定 → 相機 → 格式 選「最相容」）。
- **順序**：用 ▲▼ 調整。首頁主視覺的等高線圖和產地列用**前三支**上架中的豆子。
- **刪除**：在編輯視窗左下角，刪了無法復原；只是暫時不賣請用「售完」或「下架」。

**網站設定**：司康／門市／Email 區塊顯示開關、LINE 官方帳號 ID、Facebook 網址。

改完官網約 15 秒內更新（重新整理即可看到）。

## 檔案結構

| 路徑 | 用途 |
|---|---|
| `public/index.html` | 官網版型與文案（故事、標題、門市地址等文字改這裡） |
| `public/main.js` | 前台：從 `/api/beans` 讀資料畫出豆卡、QR code、LINE 訂購 |
| `public/admin/` | 後台頁面 |
| `functions/api/beans.js` | 公開 API：上架中的豆子＋設定 |
| `functions/api/img/[id].js` | 產品照片 |
| `functions/api/admin/[[path]].js` | 後台 API（需登入） |
| `functions/_lib/common.js` | 共用工具、Cloudflare Access JWT 驗證 |
| `db/schema.sql`、`db/seed.sql` | 資料表、初始三支豆 |
| `wrangler.toml` | Pages 設定：輸出目錄 `public`、D1 綁定、Access 變數 |

## Cloudflare 設定（已完成，留作紀錄）

- **Pages 專案** `pinncafe`：連 GitHub 自動部署。專案有 `wrangler.toml`，建置設定以此檔為準（輸出目錄 `public`）。
- **D1 資料庫** `pinncafe-www`：`wrangler.toml` 的 `[[d1_databases]]` 綁定為 `DB`。照片也存在 D1（每張約 100–300 KB）。
- **Access**：Zero Trust → Access → Applications 的「PiNNCafé 官網後台」，保護 `www.pinncafe.com/admin` 與 `www.pinncafe.com/api/admin`，只允許指定 email。
  `wrangler.toml` 的 `CF_ACCESS_TEAM_DOMAIN`、`CF_ACCESS_AUD` 是這個 Application 的識別碼（不是密鑰）；後台 API 會再驗證一次登入憑證。**沒設定時後台 API 一律拒絕**。
- **要讓別人也能進後台**：到 Zero Trust → Access → Applications →「PiNNCafé 官網後台」→ Policies，把對方 email 加進允許名單。

## 本機開發

```bash
npm i -g wrangler
wrangler d1 execute pinncafe-www --local --file=db/schema.sql
wrangler d1 execute pinncafe-www --local --file=db/seed.sql
echo 'DEV_NO_AUTH="1"' > .dev.vars     # 本機跳過登入（.dev.vars 不會進 git）
wrangler pages dev
```

打開 http://localhost:8788 （後台 http://localhost:8788/admin ）。

## 注意

- 「烘焙筆記與新到貨」區塊改為引導加入 LINE 官方帳號（新豆通知用 LINE 推播），不收 Email。
