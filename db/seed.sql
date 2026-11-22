-- 初始資料：原本 beans.json / settings.json 的內容。只在資料庫是空的時候執行一次。
INSERT INTO beans (sort, name, region, region_en, notes, process, altitude, roast, weight, price, color, show, sold_out) VALUES
  (1, '衣索比亞', '耶加雪菲', 'Yirgacheffe · Gedeo Zone', '["茉莉","藍莓","佛手柑"]', '日曬', '2200m', '淺焙', '250g', NULL, '綠', 1, 0),
  (2, '哥倫比亞', '薇拉', 'Huila · Pitalito', '["焦糖","血橙","黑糖"]', '水洗', '1900m', '中焙', '250g', NULL, '黃', 1, 0),
  (3, '瓜地馬拉', '安提瓜', 'Antigua · Sacatepéquez', '["黑巧克力","肉桂","無花果乾"]', '蜜處理', '1560m', '中深焙', '250g', NULL, '紅', 1, 0);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('showScones', 'false'),
  ('showStore', 'false'),
  ('showEmail', 'false'),
  ('lineId', '"@xat.0000179596.ezt"'),
  ('facebookUrl', '"https://www.facebook.com/PiNNCafe"');
