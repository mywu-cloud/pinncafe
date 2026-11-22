// PiNNCafé 品咖啡 — reads beans + settings from /api/beans (Cloudflare D1) and fills the page.
// Products and settings are edited in the admin page at /admin; this script does not need changes.
(function () {
  'use strict';

  // Card colours by name (bean "color" field): line colour on the card, line colour on the dark map strip.
  var COLORS = {
    '綠': { main: '#4A8B7F', light: '#5FA899' },
    '黃': { main: '#C9853A', light: '#D9A04A' },
    '紅': { main: '#B5654A', light: '#D08467' },
    '藍': { main: '#4A6F8B', light: '#6E97B8' },
    '紫': { main: '#7A5A8B', light: '#A283B3' },
    '棕': { main: '#8A6A4E', light: '#B08D6C' }
  };
  var DEFAULT_ORDER = ['綠', '黃', '紅'];

  // Three contour-line shapes for the card header, used in turn.
  var TOPO = [
    { lines: ['M0 100 Q60 75 100 85 Q140 95 180 65 Q220 35 280 45 Q320 52 360 38',
              'M0 88 Q58 60 100 72 Q142 84 180 50 Q220 18 282 30 Q322 38 360 24',
              'M0 75 Q56 44 100 58 Q143 72 180 34 Q218 0 284 14 Q322 24 360 12'], dot: [180, 34] },
    { lines: ['M0 98 Q50 82 90 92 Q130 102 160 75 Q196 45 240 58 Q280 70 360 52',
              'M0 85 Q50 64 90 76 Q132 88 160 58 Q196 25 242 38 Q282 52 360 34',
              'M0 70 Q50 46 90 60 Q133 74 160 40 Q196 6 244 22 Q284 34 360 18'], dot: [160, 40] },
    { lines: ['M0 102 Q60 92 100 100 Q130 108 160 85 Q180 66 200 85 Q230 104 280 92 Q320 82 360 70',
              'M0 88 Q60 74 100 84 Q132 94 160 68 L200 40 L240 68 Q270 88 282 78 Q320 68 360 56',
              'M0 74 Q60 56 100 68 Q132 80 160 50 L200 22 L240 50 Q268 72 284 64 Q320 54 360 42'], dot: [200, 22] }
  ];

  var settings = { showScones: false, showStore: false, showEmail: false, lineId: '@483crsha', facebookUrl: 'https://www.facebook.com/pinncafe' };
  var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function colorOf(bean, i) {
    var c = bean.color;
    if (COLORS[c]) return COLORS[c];
    if (/^#[0-9a-f]{6}$/i.test(c || '')) return { main: c, light: c };
    return COLORS[DEFAULT_ORDER[i % DEFAULT_ORDER.length]];
  }
  function priceText(bean) {
    if (typeof bean.price === 'number') return 'NT$ ' + bean.price.toLocaleString('zh-TW');
    if (typeof bean.price === 'string' && bean.price.trim()) return bean.price;
    return '價格請洽 LINE';
  }
  function chatUrl() { return 'https://line.me/R/ti/p/' + settings.lineId; }
  function orderMessage(item) { return '您好，我想訂購\n品項：' + item + '\n數量：\n收件資料：'; }
  function orderUrl(item) { return 'https://line.me/R/oaMessage/' + settings.lineId + '/?' + encodeURIComponent(orderMessage(item)); }
  function qrSvg(text, cell) {
    var qr = qrcode(0, 'L');
    qr.addData(text);
    qr.make();
    var size = cell || 4;
    var svg = qr.createSvgTag({ cellSize: size, margin: size * 2, scalable: true });
    return svg;
  }

  // ---------- toggles ----------
  function applyToggles() {
    var map = { scones: settings.showScones, store: settings.showStore, email: settings.showEmail };
    document.querySelectorAll('[data-show]').forEach(function (el) {
      el.hidden = !map[el.getAttribute('data-show')];
    });
  }

  // ---------- social links ----------
  function applySocial() {
    document.querySelectorAll('[data-fb-link]').forEach(function (a) { a.href = settings.facebookUrl; });
    document.querySelectorAll('[data-line-link]').forEach(function (a) { a.href = chatUrl(); });
    document.querySelectorAll('[data-line-id]').forEach(function (el) { el.textContent = settings.lineId; });
    var fb = document.getElementById('qr-fb');
    var ln = document.getElementById('qr-line');
    if (fb) fb.innerHTML = qrSvg(settings.facebookUrl);
    if (ln) ln.innerHTML = qrSvg(chatUrl());
  }

  // ---------- bean cards ----------
  function cardHtml(bean, i) {
    var col = colorOf(bean, i);
    var topo = TOPO[i % TOPO.length];
    var num = String(i + 1).padStart(2, '0');
    var item = bean.name + ' ' + (bean.region || '');
    var lines = topo.lines.map(function (d, k) {
      return '<path d="' + d + '" stroke="' + col.light + '" stroke-width="' + [0.8, 1, 1.2][k] + '" opacity="' + [0.5, 0.7, 0.9][k] + '"></path>';
    }).join('');
    var notes = (bean.notes || []).map(function (n) {
      return '<span style="padding: 2px 12px; border: 1px solid ' + col.main + '">' + esc(n) + '</span>';
    }).join('');
    var spec = function (label, value, mono) {
      if (!mono && !value) return '';
      return '<div style="display: flex; flex-direction: column"><span style="font-size: 12px; letter-spacing: 0.2em; color: #6B5F55">' + esc(label) + '</span>' +
        (mono ? '<span style="font-family: \'DM Mono\', \'Noto Serif TC\', ui-monospace, monospace; font-size: 14px; align-self: flex-start">' + esc(value) + '</span>'
              : '<span style="font-size: 17px">' + esc(value) + '</span>') + '</div>';
    };
    var button = bean.soldOut
      ? '<span style="display: flex; align-items: center; justify-content: center; min-height: 48px; margin-top: 4px; border: 1px solid #C4B8A5; color: #6B5F55; font-size: 14px; letter-spacing: 0.2em">已售完</span>'
      : '<a href="' + esc(chatUrl()) + '" data-order="' + esc(item) + '" aria-label="以 LINE 訂購' + esc(bean.name) + '" style="display: flex; align-items: center; justify-content: center; min-height: 48px; margin-top: 4px; background: #1E1611; color: #F6F1E7; font-size: 14px; letter-spacing: 0.2em">LINE 訂購</a>';
    var badge = bean.soldOut ? '<span style="font-family: \'Noto Serif TC\', serif; font-size: 12px; letter-spacing: 0.2em; padding: 1px 10px; border: 1px solid #6B5F55; color: #4A3F37">已售完</span>' : '';
    var head = bean.image
      ? '<div style="background: #1E1611; aspect-ratio: 4 / 3; overflow: hidden; border-bottom: 3px solid ' + col.main + '">' +
          '<img src="' + esc(bean.image) + '" alt="' + esc(bean.name + ' ' + (bean.region || '')) + '" loading="lazy" decoding="async" style="display: block; width: 100%; height: 100%; object-fit: cover' + (bean.soldOut ? '; filter: grayscale(0.6)' : '') + '">' +
        '</div>'
      : '<div style="background: #1E1611; height: 120px; overflow: hidden">' +
          '<svg aria-hidden="true" viewBox="0 0 360 120" preserveAspectRatio="none" style="display: block; width: 100%; height: 100%" fill="none">' + lines +
          '<circle cx="' + topo.dot[0] + '" cy="' + topo.dot[1] + '" r="3.5" fill="' + col.light + '"></circle></svg>' +
        '</div>';
    var desc = bean.description
      ? '<p style="margin: 0; font-size: 15px; line-height: 1.85; color: #4A3F37; white-space: pre-line">' + esc(bean.description) + '</p>'
      : '';
    return '<article style="background: #F6F1E7; display: flex; flex-direction: column' + (bean.soldOut ? '; opacity: 0.72' : '') + '">' + head +
      '<div style="padding: 32px 36px 36px; display: flex; flex-direction: column; gap: 16px; flex-grow: 1">' +
        '<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px"><span style="font-family: \'DM Mono\', ui-monospace, monospace; font-size: 12px; letter-spacing: 0.25em; color: #6B5F55">' + num + '</span>' + badge + '</div>' +
        '<div style="display: flex; flex-direction: column">' +
          '<h3 style="margin: 0; font-weight: 300; font-size: 34px; line-height: 1.3; letter-spacing: 0.06em">' + esc(bean.name) + '</h3>' +
          (bean.region ? '<span style="margin-top: 4px; font-size: 18px; letter-spacing: 0.08em; color: #4A3F37">' + esc(bean.region) + '</span>' : '') +
          (bean.regionEn ? '<span style="font-family: \'Cormorant Garamond\', \'Noto Serif TC\', serif; font-style: italic; font-size: 18px; color: #6B5F55">' + esc(bean.regionEn) + '</span>' : '') +
        '</div>' +
        '<div aria-hidden="true" style="height: 2px; background: ' + col.main + '"></div>' +
        '<div style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 13px; color: #4A3F37">' + notes + '</div>' + desc +
        '<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 12px; margin-top: auto; padding-top: 20px; border-top: 1px solid #C4B8A5">' +
          spec('處理法', bean.process) + spec('海拔', bean.altitude) + spec('焙度', bean.roast) + spec(bean.weight || '售價', priceText(bean), true) +
        '</div>' + button +
      '</div></article>';
  }

  function renderBeans(beans) {
    var list = document.getElementById('bean-list');
    var shown = beans.filter(function (b) { return b && b.show !== false && b.name; });
    if (!shown.length) {
      list.innerHTML = '<p style="margin: 0; padding: 32px; background: #F6F1E7; color: #4A3F37">新一批豆單準備中，歡迎透過 LINE 詢問。</p>';
      return shown;
    }
    list.innerHTML = shown.map(cardHtml).join('');

    // hero map + caption: first three beans
    var top = shown.slice(0, 3);
    var cap = document.getElementById('hero-beans');
    if (cap) {
      cap.innerHTML = top.map(function (b, i) {
        var c = colorOf(b, i).main;
        return '<div style="display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding: 16px 0; border-bottom: 1px solid #C4B8A5">' +
          '<span style="display: flex; align-items: center; gap: 12px"><span aria-hidden="true" style="width: 10px; height: 10px; border-radius: 50%; background: ' + c + '"></span>' + esc(b.name) + (b.region ? ' · ' + esc(b.region) : '') + '</span>' +
          '<span style="font-family: \'DM Mono\', ui-monospace, monospace; font-size: 13px; color: #6B5F55">' + esc(b.altitude) + '</span></div>';
      }).join('');
    }
    for (var i = 0; i < 3; i++) {
      var g = document.getElementById('peak-' + i), d = document.getElementById('peak-dot-' + i);
      var b = top[i];
      if (g) g.style.display = b ? '' : 'none';
      if (d) d.style.display = b ? '' : 'none';
      if (b && g) g.setAttribute('stroke', colorOf(b, i).main);
      if (b && d) d.setAttribute('fill', colorOf(b, i).main);
    }
    var map = document.getElementById('hero-map');
    if (map) map.setAttribute('aria-label', '產地等高線圖：' + top.map(function (b) { return b.name + ' ' + (b.altitude || ''); }).join('、'));

    var ZH = ['零', '一', '兩', '三', '四', '五', '六', '七', '八', '九', '十'];
    var avail = shown.filter(function (b) { return !b.soldOut; }).length;
    document.querySelectorAll('[data-bean-count]').forEach(function (el) {
      var n = el.closest('#shop') ? avail : shown.length;
      el.textContent = ZH[n] || String(n);
    });
    var stat = document.getElementById('stat-origins');
    if (stat) stat.textContent = String(shown.length);
    var shop = document.getElementById('shop-origins');
    if (shop) {
      var avail = shown.filter(function (b) { return !b.soldOut; }).map(function (b) { return b.name; });
      shop.textContent = avail.length ? avail.join(' · ') : '目前豆子皆已售完，歡迎透過 LINE 詢問下一批。';
    }
    return shown;
  }

  // ---------- LINE ordering ----------
  var modal, currentItem = '';
  function openOrder(item) {
    currentItem = item;
    document.getElementById('order-item').textContent = item;
    document.getElementById('order-qr').innerHTML = qrSvg(orderUrl(item));
    document.getElementById('order-copied').textContent = '';
    modal.hidden = false;
    document.getElementById('order-close').focus();
  }
  function closeOrder() { modal.hidden = true; }
  function bindOrdering() {
    modal = document.getElementById('order-modal');
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-order]');
      if (!a) return;
      e.preventDefault();
      var item = a.getAttribute('data-order');
      if (isMobile) { window.location.href = orderUrl(item); return; }
      openOrder(item);
    });
    document.getElementById('order-close').addEventListener('click', closeOrder);
    modal.addEventListener('click', function (e) { if (e.target === modal.firstElementChild) closeOrder(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeOrder(); });
    document.getElementById('order-copy').addEventListener('click', function () {
      var out = document.getElementById('order-copied');
      var text = orderMessage(currentItem);
      var ok = function () { out.textContent = '已複製，可貼到 LINE 聊天視窗送出。'; };
      var fail = function () { out.textContent = '無法自動複製，請改用手機掃描。'; };
      try { navigator.clipboard.writeText(text).then(ok, fail); } catch (err) { fail(); }
    });
  }

  // ---------- newsletter ----------
  function bindNewsletter() {
    var form = document.getElementById('nl-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      document.getElementById('nl-form-wrap').hidden = true;
      document.getElementById('nl-thanks').hidden = false;
    });
  }

  function loadJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindOrdering();
    bindNewsletter();
    var finish = function () {
      applyToggles();
      applySocial();
      document.querySelectorAll('a[data-order]').forEach(function (a) { a.href = chatUrl(); });
    };
    loadJson('/api/beans').then(function (data) {
      Object.keys((data && data.settings) || {}).forEach(function (k) { settings[k] = data.settings[k]; });
      finish();
      renderBeans((data && data.beans) || []);
    }).catch(function (err) {
      finish();
      var st = document.getElementById('bean-status');
      if (st) st.textContent = '豆單暫時無法載入，請稍後再試，或透過 LINE 詢問。';
      console.error(err);
    });
  });
})();
