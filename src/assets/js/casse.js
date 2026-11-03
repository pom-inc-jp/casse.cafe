// =================================================================
// casse.js　casse.cafe の動き
//   1) スマホの追従メニュー（カセット）：少しスクロールすると右上に出る。スクロールでリールが回る
//   2) お知らせの絞り込み（カテゴリのボタン）
//   3) 今いるページのメニューに印を付ける
//   4) 計測用：外部リンクや地図のクリックを GTM に送る
//   5) PCのポインターを黒い点と輪にする（リンクの上では輪が水色になって大きくなる）
// =================================================================
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- 1) カセットのメニュー ---
  var fab = document.querySelector('[data-fab]');
  if (fab) {
    var btn = fab.querySelector('.fab-btn');
    var menu = fab.querySelector('.fab-menu');
    var reels = fab.querySelectorAll('.reel');
    var SHOW_AT = 240;
    var ticking = false;

    var setOpen = function (open) {
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', btn.getAttribute(open ? 'data-close-label' : 'data-open-label'));
    };
    var update = function () {
      ticking = false;
      var y = window.scrollY || 0;
      var show = y > SHOW_AT;
      fab.classList.toggle('is-shown', show);
      if (!show) setOpen(false);
      if (!reduce) {
        var deg = Math.round(y * 0.8) % 360;
        for (var i = 0; i < reels.length; i++) reels[i].style.transform = 'rotate(' + deg + 'deg)';
      }
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();

    btn.addEventListener('click', function () { setOpen(menu.hidden); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { setOpen(false); btn.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (!menu.hidden && !fab.contains(e.target)) setOpen(false);
    });
  }

  // --- 2) お知らせの絞り込み ---
  document.querySelectorAll('.filters[data-target]').forEach(function (group) {
    var list = document.getElementById(group.getAttribute('data-target'));
    if (!list) return;
    var empty = document.querySelector('[data-empty="' + list.id + '"]');
    var limit = Number(list.getAttribute('data-limit')) || 0;
    var rows = list.querySelectorAll('li');
    group.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      group.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      var g = b.getAttribute('data-genre');
      var shown = 0;
      rows.forEach(function (li) {
        var hit = g === 'all' || li.getAttribute('data-genre') === g;
        var on = hit && (!limit || shown < limit);
        li.hidden = !on;
        if (on) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    });
  });

  // --- 3) 今いるページのメニューに印 ---
  var here = location.pathname;
  document.querySelectorAll('.gnav a, .fab-menu a').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href && href.indexOf('#') === -1 && href !== '/' && here.indexOf(href) === 0) a.setAttribute('aria-current', 'page');
  });

  // --- 4) クリックの計測 ---
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    var type = '';
    if (/instagram\.com/.test(href)) type = 'instagram';
    else if (/google\.[^/]+\/maps/.test(href)) type = 'map';
    else if (/^mailto:/.test(href)) type = 'mail';
    else if (/^https?:\/\//.test(href) && a.host !== location.host) type = 'external';
    if (!type) return;
    var place = a.closest('.fab-menu') ? 'fab' : a.closest('.site-foot') ? 'footer' : (a.closest('section[id]') || {}).id || 'main';
    (window.dataLayer = window.dataLayer || []).push({ event: 'link_click', link_type: type, link_store: 'casse', link_place: place, link_url: a.href });
  });

  // --- 5) PCのポインター（黒い点と、少し遅れてついてくる輪）。マウス操作の画面で、動きを減らす設定でないときだけ ---
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (fine && !reduce) {
    var dot = document.createElement('div');
    var ring = document.createElement('div');
    dot.className = 'cur-dot';
    ring.className = 'cur-ring';
    dot.setAttribute('aria-hidden', 'true');
    ring.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ring);
    document.body.appendChild(dot);
    document.documentElement.classList.add('has-dot-cursor');
    var mx = 0, my = 0, rx = 0, ry = 0, loop = 0;
    var step = function () {
      // 輪は点を追いかけて少しずつ近づく
      rx += (mx - rx) * 0.2;
      ry += (my - ry) * 0.2;
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
      loop = (Math.abs(mx - rx) > 0.1 || Math.abs(my - ry) > 0.1) ? window.requestAnimationFrame(step) : 0;
    };
    document.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (!dot.classList.contains('is-on')) { rx = mx; ry = my; }
      dot.classList.add('is-on'); ring.classList.add('is-on');
      if (!loop) loop = window.requestAnimationFrame(step);
    }, { passive: true });
    document.addEventListener('mouseover', function (e) {
      ring.classList.toggle('is-link', !!e.target.closest('a, button, [role="button"]'));
    });
    document.addEventListener('mousedown', function () { ring.classList.add('is-down'); });
    document.addEventListener('mouseup', function () { ring.classList.remove('is-down'); });
    document.documentElement.addEventListener('mouseleave', function () { dot.classList.remove('is-on'); ring.classList.remove('is-on'); });
  }

  // ---------------------------------------------------------------
  // 撮影ページのギャラリー。小さい写真を押すと上の大きい写真が入れ替わり、
  // 大きい写真を押すと画面いっぱいに拡大表示（dialog.lightbox）する
  // ---------------------------------------------------------------
  const sg = document.querySelector('[data-gallery]');
  if (sg) {
    const thumbs = Array.prototype.slice.call(sg.querySelectorAll('.sg-thumbs a'));
    const stage = sg.querySelector('.sg-open img');
    const capT = sg.querySelector('.sg-cap .t');
    const capN = sg.querySelector('.sg-cap .n');
    const lb = document.querySelector('dialog.lightbox');
    const big = lb && lb.querySelector('img');
    const lbCap = lb && lb.querySelector('.lb-cap');
    let cur = 0;
    const label = function (i) { return (i + 1) + ' / ' + thumbs.length; };
    const show = function (i, scroll) {
      cur = (i + thumbs.length) % thumbs.length;
      const a = thumbs[cur];
      stage.srcset = a.dataset.srcset;
      stage.src = a.getAttribute('href');
      stage.alt = a.dataset.alt;
      capT.textContent = a.dataset.alt;
      capN.textContent = label(cur);
      thumbs.forEach(function (t, k) { t.setAttribute('aria-current', k === cur ? 'true' : 'false'); });
      if (lb && lb.open) {
        big.src = a.getAttribute('href');
        big.alt = a.dataset.alt;
        lbCap.textContent = a.dataset.alt + '（' + label(cur) + '）';
      }
    };
    thumbs.forEach(function (a, i) {
      a.addEventListener('click', function (e) { e.preventDefault(); show(i, false); });
    });
    sg.querySelector('.sg-prev').addEventListener('click', function () { show(cur - 1, true); });
    sg.querySelector('.sg-next').addEventListener('click', function () { show(cur + 1, true); });

    if (lb && typeof lb.showModal === 'function') {
      sg.querySelector('.sg-open').addEventListener('click', function () {
        lb.showModal();
        show(cur, false);
      });
      lb.querySelector('.lb-prev').addEventListener('click', function () { show(cur - 1, true); });
      lb.querySelector('.lb-next').addEventListener('click', function () { show(cur + 1, true); });
      lb.querySelector('.lb-close').addEventListener('click', function () { lb.close(); });
      // 写真の外（黒いところ）を押しても閉じる
      lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
      lb.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') show(cur - 1, true);
        if (e.key === 'ArrowRight') show(cur + 1, true);
      });
    }
    // スマホは左右にスワイプで送る（大きい写真・拡大表示どちらでも）
    [sg.querySelector('.sg-stage'), lb].forEach(function (el) {
      if (!el) return;
      let x0 = null;
      el.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      el.addEventListener('touchend', function (e) {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1), true);
        x0 = null;
      });
    });
  }
})();
