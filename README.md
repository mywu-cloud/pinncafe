# PiNNCafé 品咖啡 官網（www.pinncafe.com）

一般的靜態網站，不需要建置步驟。換豆、改設定只要編輯 JSON 檔，推到 GitHub，Cloudflare Pages 就會自動更新。

## 檔案

| 檔案 | 用途 | 平常會改嗎 |
|---|---|---|
| `beans.json` | 豆單：產地、風味、價格、是否售完 | **會**，換豆時改這裡 |
| `settings.json` | 司康／門市／Email 顯示開關、LINE ID、Facebook 網址 | 偶爾 |
| `index.html` | 頁面版型與文字（故事、標題等） | 改文案時才動 |
| `main.js` | 讀取兩個 JSON 並畫出豆卡、QR code、LINE 訂購 | 不用改 |
| `vendor/qrcode.js` | 產生 QR code 的程式庫（MIT 授權） | 不用改 |

## 換豆：編輯 `beans.json`

每支豆是一個區塊，依檔案中的順序顯示，編號 01、02… 會自動排。主視覺的等高線圖和下方的產地列，會用**前三支**豆子。

```json
{
  "name": "衣索比亞",
  "region": "耶加雪菲",
  "regionEn": "Yirgacheffe · Gedeo Zone",
  "notes": ["茉莉", "藍莓", "佛手柑"],
  "process": "日曬",
  "altitude": "2200m",
  "roast": "淺焙",
  "weight": "250g",
  "price": 480,
  "soldOut": false,
  "show": true,
  "color": "綠"
}
```

| 欄位 | 說明 |
|---|---|
| `name` | 產地（大字） |
| `region` | 產區，接在產地後面，也會出現在 LINE 訂購訊息裡 |
| `regionEn` | 卡片上的英文斜體小字 |
| `notes` | 風味，幾個都可以 |
| `process`／`altitude`／`roast` | 處理法／海拔／焙度 |
| `weight` | 價格上方的小標，例如 `250g`、`半磅` |
| `price` | 數字，例如 `480`，會顯示成「NT$ 480」；寫 `null` 會顯示「價格請洽 LINE」 |
| `soldOut` | `true` 時標示「已售完」，訂購按鈕會停用 |
| `show` | `false` 時暫時不顯示這支豆（資料保留） |
| `color` | 卡片顏色：`綠`、`黃`、`紅`、`藍`、`紫`、`棕`，或色碼如 `#4A8B7F` |

**新增一支豆**：複製一整個 `{ … }` 區塊，貼在最後一支後面。兩個區塊之間要有逗號，最後一個區塊後面不能有逗號。

**改完不確定格式對不對**：把內容貼到 https://jsonlint.com 檢查。格式錯誤時，網站的豆單區會顯示「豆單暫時無法載入」。

## 顯示開關：編輯 `settings.json`

```json
{
  "showScones": false,
  "showStore": false,
  "showEmail": false,
  "lineId": "@483crsha",
  "facebookUrl": "https://www.facebook.com/PiNNCafe"
}
```

- `showScones`：司康上架時改 `true`，烘焙坊區塊、司康禮盒等會一起出現。
- `showStore`：門市開幕時改 `true`，門市資訊、「來找我們」區塊會出現（地址等文字在 `index.html` 裡，記得先填好）。
- `showEmail`：在「追蹤品咖啡」區塊顯示 Email。
- `lineId`：LINE 官方帳號 ID。頁尾 QR code、LINE 訂購按鈕會一起換掉。專屬 ID `@pinncafe` 可以搜尋到之後，改成 `"@pinncafe"` 即可。
- `facebookUrl`：Facebook 粉絲專頁網址，QR code 會自動重新產生。

## LINE 訂購怎麼運作

- **手機**：點「LINE 訂購」直接開啟官方帳號聊天，訂購訊息已填好。
- **電腦**：跳出視窗，顯示該品項專屬的 QR code；用手機掃描即開啟聊天並帶入訊息。也可以按「複製訂購內容」貼到 LINE。

## 本機預覽

直接雙擊 `index.html` 會讀不到 JSON（瀏覽器的安全限制），豆單區會出現提示。請在這個資料夾開終端機執行：

```bash
python3 -m http.server 8000
```

然後用瀏覽器打開 http://localhost:8000 。

## 部署到 Cloudflare Pages

1. 把這個資料夾推到 GitHub（例如新的 repo `mywu-cloud/pinncafe-www`）。
2. Cloudflare → Workers & Pages → 建立 → Pages → 連接 GitHub，選這個 repo。
3. 建置設定：Framework preset 選 **None**，Build command **留空**，Build output directory 填 **`/`**。
4. 部署完成後，在專案的「Custom domains」加上 `www.pinncafe.com`（DNS 已在 Cloudflare，會自動設定）。

之後只要推送到 GitHub，網站幾十秒內就會更新。

## 注意

- 「烘焙筆記與新到貨」的訂閱表單目前**不會儲存 Email**，只會顯示感謝訊息。要真的收集名單，需要串接電子報服務（例如 Mailchimp）或 Google 表單。
