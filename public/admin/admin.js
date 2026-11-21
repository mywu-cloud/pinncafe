// PiNNCafé 後台：豆單管理與網站設定
(function () {
  'use strict';

  var COLORS = { '綠': '#4A8B7F', '黃': '#C9853A', '紅': '#B5654A', '藍': '#4A6F8B', '紫': '#7A5A8B', '棕': '#8A6A4E' };
  var beans = [];
  var editing = null;      // 正在編輯的豆子（null = 新增）
  var pendingPhoto = null; // 新增時先選的照片，存檔後才上傳

  var $ = function (s, el) { return (el || document).querySelector(s); };
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var toastTimer;
  function toast(msg, isErr) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, isErr ? 5000 : 2200);
  }

  function api(method, path, body, type) {
    var opt = { method: method, headers: {}, credentials: 'same-origin' };
    if (body !== undefined) {
      if (type) { opt.headers['Content-Type'] = type; opt.body = body; }
      else { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    }
    return fetch('/api/admin/' + path, opt).then(function (r) {
      var ct = r.headers.get('Content-Type') || '';
      if (!ct.includes('application/json')) {
        // Access 登入過期時會被導到登入頁
        throw new Error(r.status === 200 || r.redirected ? '登入已過期，請重新整理頁面' : '連線錯誤（' + r.status + '）');
      }
      return r.json().then(function (d) {
        if (!r.ok) throw new Error(d.error || '發生錯誤');
        return d;
      });
    });
  }

  // ---------- 豆單列表 ----------
  function priceText(b) { return b.price == null ? '洽 LINE' : 'NT$ ' + Number(b.price).toLocaleString('zh-TW'); }

  function render() {
    var list = $('#bean-list');
    if (!beans.length) {
      list.innerHTML = '<p class="empty">還沒有豆子，按「＋ 新增豆子」開始。</p>';
      return;
    }
    list.innerHTML = beans.map(function (b, i) {
      var col = COLORS[b.color] || (/^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#6B5F55');
      var pic = b.image
        ? '<img class="thumb" src="' + esc(b.image) + '" alt="">'
        : '<div class="swatch" style="background:' + esc(col) + '">無照片</div>';
      var tags = (b.show ? '' : '<span class="tag hide">已下架</span>') +
        (b.soldOut ? '<span class="tag sold">售完</span>' : '<span class="tag ok">有貨</span>');
      return '<div class="item' + (b.show ? '' : ' off') + '" data-id="' + b.id + '">' + pic +
        '<div class="info"><h3>' + esc(b.name) + '<small>' + esc(b.region) + '</small></h3>' +
          '<div class="meta"><span>' + esc(priceText(b)) + (b.weight ? ' / ' + esc(b.weight) : '') + '</span>' +
          (b.roast ? '<span>' + esc(b.roast) + '</span>' : '') + (b.process ? '<span>' + esc(b.process) + '</span>' : '') + '</div>' +
          '<div class="tags">' + tags + '</div></div>' +
        '<div class="ctrls">' +
          (b.soldOut
            ? '<button class="btn primary" data-act="restock">補貨上架</button>'
            : '<button class="btn" data-act="soldout">售完</button>') +
          '<button class="btn ghost" data-act="toggle-show">' + (b.show ? '下架' : '顯示') + '</button>' +
          '<button class="btn ghost" data-act="edit">編輯</button>' +
          '<div class="move"><button data-act="up" aria-label="往前" ' + (i === 0 ? 'disabled' : '') + '>▲</button>' +
          '<button data-act="down" aria-label="往後" ' + (i === beans.length - 1 ? 'disabled' : '') + '>▼</button></div>' +
        '</div></div>';
    }).join('');
  }

  function load() {
    return api('GET', 'beans').then(function (d) { beans = d.beans; render(); })
      .catch(function (e) { $('#bean-list').innerHTML = '<p class="empty">' + esc(e.message) + '</p>'; });
  }

  function replaceBean(b) {
    var i = beans.findIndex(function (x) { return x.id === b.id; });
    if (i >= 0) beans[i] = b; else beans.push(b);
    render();
  }

  $('#bean-list').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var id = Number(btn.closest('.item').getAttribute('data-id'));
    var b = beans.find(function (x) { return x.id === id; });
    var act = btn.getAttribute('data-act');
    if (act === 'edit') return openEdit(b);
    if (act === 'up' || act === 'down') return move(id, act === 'up' ? -1 : 1);
    var change = act === 'soldout' ? { soldOut: true }
      : act === 'restock' ? { soldOut: false, show: true }
      : { show: !b.show };
    btn.disabled = true;
    api('PUT', 'beans/' + id, change).then(function (d) {
      replaceBean(d.bean);
      toast(act === 'soldout' ? b.name + ' 已標示售完' : act === 'restock' ? b.name + ' 已補貨上架' : (d.bean.show ? '已顯示在官網' : '已從官網下架'));
    }).catch(function (err) { btn.disabled = false; toast(err.message, true); });
  });

  function move(id, dir) {
    var i = beans.findIndex(function (x) { return x.id === id; });
    var j = i + dir;
    if (j < 0 || j >= beans.length) return;
    var t = beans[i]; beans[i] = beans[j]; beans[j] = t;
    render();
    api('PUT', 'order', { ids: beans.map(function (b) { return b.id; }) })
      .then(function () { toast('順序已更新'); })
      .catch(function (err) { toast(err.message, true); load(); });
  }

  // ---------- 編輯視窗 ----------
  var dlg = $('#edit'), form = $('#edit-form');

  function setPhoto(src) {
    $('#photo-box').innerHTML = src ? '<img src="' + esc(src) + '" alt="">' : '<span>尚無照片</span>';
    $('#photo-remove').hidden = !src;
  }

  function ensureColorOption(c) {
    var sel = form.elements.color;
    if (c && !Array.prototype.some.call(sel.options, function (o) { return o.value === c; })) {
      var o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o);
    }
  }

  function openEdit(b) {
    editing = b || null;
    pendingPhoto = null;
    form.reset();
    $('#edit-title').textContent = b ? '編輯：' + b.name : '新增豆子';
    $('#delete-bean').hidden = !b;
    var v = b || { show: true, soldOut: false, color: ['綠', '黃', '紅', '藍', '紫', '棕'][beans.length % 6], weight: '250g', notes: [] };
    ['name', 'region', 'regionEn', 'description', 'process', 'altitude', 'roast', 'weight'].forEach(function (k) {
      form.elements[k].value = v[k] || '';
    });
    form.elements.notes.value = (v.notes || []).join('、');
    form.elements.price.value = v.price == null ? '' : v.price;
    ensureColorOption(v.color);
    form.elements.color.value = v.color || '綠';
    form.elements.show.checked = !!v.show;
    form.elements.soldOut.checked = !!v.soldOut;
    setPhoto(v.image);
    dlg.showModal();
    if (!b) form.elements.name.focus();
  }

  dlg.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]') || e.target === dlg) dlg.close();
  });

  function formData() {
    var f = form.elements;
    return {
      name: f.name.value, region: f.region.value, regionEn: f.regionEn.value, description: f.description.value,
      notes: f.notes.value, process: f.process.value, altitude: f.altitude.value, roast: f.roast.value,
      weight: f.weight.value, price: f.price.value === '' ? null : Number(f.price.value), color: f.color.value,
      show: f.show.checked, soldOut: f.soldOut.checked
    };
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = formData();
    if (!data.name.trim()) { toast('請填寫產地', true); return; }
    var save = $('#save-bean');
    save.disabled = true;
    var req = editing ? api('PUT', 'beans/' + editing.id, data) : api('POST', 'beans', data);
    req.then(function (d) {
      if (pendingPhoto) return api('PUT', 'beans/' + d.bean.id + '/image', pendingPhoto, pendingPhoto.type);
      return d;
    }).then(function (d) {
      replaceBean(d.bean);
      dlg.close();
      toast(editing ? '已儲存' : '已新增 ' + d.bean.name);
    }).catch(function (err) { toast(err.message, true); })
      .then(function () { save.disabled = false; });
  });

  $('#delete-bean').addEventListener('click', function () {
    if (!editing) return;
    if (!window.confirm('確定要刪除「' + editing.name + '」？刪除後無法復原。\n（只是暫時不賣的話，用「售完」或「下架」就好。）')) return;
    var id = editing.id;
    api('DELETE', 'beans/' + id).then(function () {
      beans = beans.filter(function (b) { return b.id !== id; });
      render();
      dlg.close();
      toast('已刪除');
    }).catch(function (err) { toast(err.message, true); });
  });

  // ---------- 照片：在瀏覽器先縮小再上傳 ----------
  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var max = 1200;
        var scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error('照片轉換失敗')); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('無法讀取這張照片（HEIC 請先轉成 JPG）')); };
      img.src = url;
    });
  }

  $('#photo-input').addEventListener('change', function () {
    var file = this.files && this.files[0];
    this.value = '';
    if (!file) return;
    resizeImage(file).then(function (blob) {
      if (!editing) {
        pendingPhoto = blob;
        setPhoto(URL.createObjectURL(blob));
        toast('照片會在按「儲存」後上傳');
        return;
      }
      toast('照片上傳中…');
      return api('PUT', 'beans/' + editing.id + '/image', blob, blob.type).then(function (d) {
        editing = d.bean;
        replaceBean(d.bean);
        setPhoto(d.bean.image);
        toast('照片已更新');
      });
    }).catch(function (err) { toast(err.message, true); });
  });

  $('#photo-remove').addEventListener('click', function () {
    if (!editing) { pendingPhoto = null; setPhoto(null); return; }
    if (!window.confirm('移除這支豆子的照片？')) return;
    api('DELETE', 'beans/' + editing.id + '/image').then(function (d) {
      editing = d.bean;
      replaceBean(d.bean);
      setPhoto(null);
      toast('照片已移除');
    }).catch(function (err) { toast(err.message, true); });
  });

  $('#add-bean').addEventListener('click', function () { openEdit(null); });

  // ---------- 網站設定 ----------
  var sform = $('#settings-form');
  function loadSettings() {
    return api('GET', 'settings').then(function (d) {
      var s = d.settings;
      ['showScones', 'showStore', 'showEmail'].forEach(function (k) { sform.elements[k].checked = !!s[k]; });
      sform.elements.lineId.value = s.lineId || '';
      sform.elements.facebookUrl.value = s.facebookUrl || '';
    }).catch(function (err) { toast(err.message, true); });
  }
  sform.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = sform.elements;
    api('PUT', 'settings', {
      showScones: f.showScones.checked, showStore: f.showStore.checked, showEmail: f.showEmail.checked,
      lineId: f.lineId.value, facebookUrl: f.facebookUrl.value
    }).then(function () { toast('設定已儲存'); }).catch(function (err) { toast(err.message, true); });
  });

  // ---------- 分頁 ----------
  document.querySelectorAll('[data-tab]').forEach(function (t) {
    t.addEventListener('click', function () {
      document.querySelectorAll('[data-tab]').forEach(function (x) { x.setAttribute('aria-selected', x === t ? 'true' : 'false'); });
      $('#tab-beans').hidden = t.getAttribute('data-tab') !== 'beans';
      $('#tab-settings').hidden = t.getAttribute('data-tab') !== 'settings';
    });
  });

  api('GET', 'me').then(function (d) { $('#me').textContent = d.email; }).catch(function () {});
  load();
  loadSettings();
})();
