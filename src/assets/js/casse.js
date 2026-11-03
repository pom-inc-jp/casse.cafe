// =================================================================
// casse.js　casse.cafe の動き
//   1) スマホの追従メニュー（カセット）：少しスクロールすると右上に出る。スクロールでリールが回る
//   2) お知らせの絞り込み（カテゴリのボタン）
//   3) 今いるページのメニューに印を付ける
//   4) 計測用：外部リンクや地図のクリックを GTM に送る
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
})();
