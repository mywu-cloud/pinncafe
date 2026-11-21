-- PiNNCafé 官網資料庫（Cloudflare D1）
-- 只需執行一次；重複執行也不會清掉資料（IF NOT EXISTS）。

CREATE TABLE IF NOT EXISTS beans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sort        INTEGER NOT NULL DEFAULT 0,      -- 顯示順序，小的在前
  name        TEXT    NOT NULL,                -- 產地（大字）
  region      TEXT    NOT NULL DEFAULT '',     -- 產區
  region_en   TEXT    NOT NULL DEFAULT '',     -- 英文小字
  description TEXT    NOT NULL DEFAULT '',     -- 介紹文字（可空白）
  notes       TEXT    NOT NULL DEFAULT '[]',   -- 風味，JSON 陣列
  process     TEXT    NOT NULL DEFAULT '',
  altitude    TEXT    NOT NULL DEFAULT '',
  roast       TEXT    NOT NULL DEFAULT '',
  weight      TEXT    NOT NULL DEFAULT '',     -- 規格，例如 250g
  price       INTEGER,                         -- NULL = 價格請洽 LINE
  color       TEXT    NOT NULL DEFAULT '',
  show        INTEGER NOT NULL DEFAULT 1,      -- 1 = 上架顯示
  sold_out    INTEGER NOT NULL DEFAULT 0,      -- 1 = 已售完
  image_ver   INTEGER NOT NULL DEFAULT 0,      -- 0 = 沒有照片；>0 = 照片版本（換照片時更新，避免快取舊圖）
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bean_images (
  bean_id INTEGER PRIMARY KEY REFERENCES beans(id) ON DELETE CASCADE,
  type    TEXT NOT NULL,
  data    BLOB NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
