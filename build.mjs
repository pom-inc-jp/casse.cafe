// =================================================================
// build.mjs　casse.cafe の書き出し（静的HTMLを dist/ に作る）
//
//   node build.mjs           … 書き出し
//   node build.mjs --serve   … 書き出してから http://localhost:8080 で確認
//
// 追加のライブラリは使っていません（Node.js 18 以上だけで動きます）。
// しくみは retopo.cafe・pom-inc.co.jp と同じです。
//   src/pages/**.html      … 各ページの本文。先頭の --- { JSON } --- にタイトルなどを書く
//   src/_layouts/*.html    … ページの外枠
//   src/_partials/*.html   … 共通部品。{{> header}} のように読み込む
//   src/_templates/*.html  … お知らせ記事ページのひな形
//   src/_data/*.json       … お店の情報・お知らせ・メディア掲載・メニュー
//   src/assets/            … CSS・JS・画像（そのまま dist/assets/ にコピー）
//   src/static/            … ファビコン・robots.txt・.htaccess など（dist/ 直下にコピー）
//
// テンプレートの書き方
//   {{site.name}}      … 値を差し込む（HTMLの記号は自動でエスケープ）
//   {{{news.latest}}}  … HTMLをそのまま差し込む（このファイルで組み立てた部品）
//   {{> header}}       … 共通部品を差し込む
// =================================================================

import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { addPhraseBreaks } from './lib/phrase.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist');
const STORE = 'casse';

// ---------------------------------------------------------------
// 小さな道具
// ---------------------------------------------------------------
const readJSON = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isExternal = (url) => /^https?:\/\//.test(url);
const linkAttrs = (url) => (isExternal(url) ? ' target="_blank" rel="noopener"' : '');
const dateLabel = (d) => d.replace(/-/g, '.');
const yen = (n) => (n == null ? '—' : `¥${Number(n).toLocaleString('en-US')}`);

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

async function copyDir(from, to) {
  if (!fss.existsSync(from)) return;
  await fs.cp(from, to, { recursive: true });
}

// ---------------------------------------------------------------
// テンプレート
// ---------------------------------------------------------------
function lookup(ctx, key, where) {
  const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);
  if (v === undefined) throw new Error(`テンプレートの値が見つかりません: {{${key}}}（${where}）`);
  return v;
}

function render(tpl, ctx, partials, where) {
  let out = tpl.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
    if (!(name in partials)) throw new Error(`共通部品が見つかりません: {{> ${name}}}（${where}）`);
    return render(partials[name], ctx, partials, `_partials/${name}.html`);
  });
  out = out.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, k) => String(lookup(ctx, k, where)));
  out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => esc(lookup(ctx, k, where)));
  return out;
}

function parseFrontMatter(src, file) {
  const m = src.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!m) return { meta: {}, body: src };
  try {
    return { meta: JSON.parse(m[1]), body: src.slice(m[0].length) };
  } catch (e) {
    throw new Error(`${file} の先頭の設定（JSON）が読めません: ${e.message}`);
  }
}

// ---------------------------------------------------------------
// 写真
// ---------------------------------------------------------------
// WebP の幅と高さをファイルの先頭から読む
function webpSize(file) {
  const b = fss.readFileSync(file);
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (kind === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
}

// 写真1枚ぶんの src / srcset。「ファイル名-400.webp」があれば小さく出すときはそちらを使う
function photo(name) {
  const dir = path.join(SRC, 'assets/img/photos');
  const full = path.join(dir, `${name}.webp`);
  if (!fss.existsSync(full)) throw new Error(`写真が見つかりません: assets/img/photos/${name}.webp`);
  const big = webpSize(full);
  const list = [];
  const small = path.join(dir, `${name}-400.webp`);
  if (fss.existsSync(small)) list.push(`/assets/img/photos/${name}-400.webp 400w`);
  list.push(`/assets/img/photos/${name}.webp ${big.w}w`);
  return { src: `/assets/img/photos/${name}.webp`, srcset: list.join(', '), w: big.w, h: big.h };
}

function img(p, sizes, { lazy = true, cls = '', priority = false, alt, pos } = {}) {
  const o = photo(p.file);
  const altText = alt ?? p.alt ?? '';
  return `<img${cls ? ` class="${cls}"` : ''}${pos ? ` style="object-position:${esc(pos)}"` : ''} src="${o.src}" srcset="${o.srcset}" sizes="${sizes}" alt="${esc(altText)}" width="${o.w}" height="${o.h}"${lazy ? ' loading="lazy"' : ''}${priority ? ' fetchpriority="high"' : ''} decoding="async">`;
}

// ---------------------------------------------------------------
// アイコン（ご利用案内）。線だけのアイコンで、色は文字色に合わせる
// ---------------------------------------------------------------
const ICONS = {
  ticket: '<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z"/><path d="M15 7v2M15 11v2M15 15v2"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  chair: '<path d="M7 3v9h10V3M5 12h14M7 12v9M17 12v9M7 17h10"/>',
  wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r=".8"/>',
  paw: '<circle cx="6.5" cy="10" r="1.8"/><circle cx="10" cy="5.5" r="1.8"/><circle cx="14" cy="5.5" r="1.8"/><circle cx="17.5" cy="10" r="1.8"/><path d="M8 17.5c0-3 1.8-5.5 4-5.5s4 2.5 4 5.5c0 2-2 2.5-4 2.5s-4-.5-4-2.5z"/>',
  nocassette: '<rect x="3" y="6" width="18" height="12" rx="1.5"/><circle cx="9" cy="11" r="1.5"/><circle cx="15" cy="11" r="1.5"/><path d="M7.5 18l1.5-3h6l1.5 3"/><path d="M3 3l18 18"/>',
  parking: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3"/>',
  seat: '<circle cx="12" cy="7" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3"/>',
  quiet: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9.5l4 5M21 9.5l-4 5"/>',
  store: '<path d="M4 10l8-6 8 6v10H4z"/><path d="M10 20v-6h4v6"/>',
  // 楽しみ方
  cup: '<path d="M5 8h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M9 3v2M13 3v2"/>',
  play: '<rect x="3" y="5" width="18" height="13" rx="1.5"/><path d="M10 9v5l4.5-2.5z"/><path d="M8 21h8"/>',
  player: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><rect x="6" y="7" width="12" height="7" rx="1"/><circle cx="9.5" cy="10.5" r="1.2"/><circle cx="14.5" cy="10.5" r="1.2"/><path d="M7 17h2M11 17h2M15 17h2"/>',
  cassette: '<rect x="3" y="6" width="18" height="12" rx="1.5"/><circle cx="9" cy="11" r="1.5"/><circle cx="15" cy="11" r="1.5"/><path d="M7.5 18l1.5-3h6l1.5 3"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  // 撮影・取材のご依頼
  door: '<path d="M6 21V3h12v18"/><path d="M4 21h16"/><circle cx="14.5" cy="12" r=".8"/>',
  kitchen: '<path d="M5 3v8a2 2 0 0 0 4 0V3M7 11v10"/><path d="M16 21V3c2.5 1.5 3 5 3 8h-3"/>',
  layout: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><path d="M14 6.5h4.5a2.5 2.5 0 0 1 2.5 2.5v1M10 17.5H5.5A2.5 2.5 0 0 1 3 15v-1"/>',
  nofire: '<path d="M12 21c-3.5 0-6-2.4-6-5.6 0-3.4 3-5.4 3.5-9.4 2.5 1.5 3.5 4 3.5 5.5.8-.6 1.5-1.7 1.7-3 1.5 1.5 3.3 4 3.3 6.9 0 3.2-2.5 5.6-6 5.6z"/><path d="M3 3l18 18"/>'
};
function icon(name, size = 20) {
  if (!ICONS[name]) throw new Error(`アイコンが見つかりません: ${name}（使えるもの: ${Object.keys(ICONS).join(' / ')}）`);
  return `<svg class="ico" aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
}

// ---------------------------------------------------------------
// お知らせ
// ---------------------------------------------------------------
async function loadNews(site) {
  const items = (await readJSON(path.join(SRC, '_data/news.json'))).items || [];
  const seen = new Set();
  const valid = [];
  for (const n of items) {
    const problems = [];
    if (!/^[a-z0-9-]+$/.test(n.id || '')) problems.push('id は半角英小文字・数字・ハイフンのみ');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(n.date || '')) problems.push('date は 2026-11-02 の形');
    if (!site.genres[n.genre]) problems.push(`genre は ${Object.keys(site.genres).join(' / ')} のどれか`);
    if (n.store !== STORE) problems.push(`store は "${STORE}"（会社サイトに取り込むときに使う）`);
    if (!n.title) problems.push('title がありません');
    if (seen.has(n.id)) problems.push('同じ id の記事がすでにあります');
    if (problems.length) {
      // 書き間違いは書き出しを止めて知らせる（そのまま公開されないように）
      throw new Error(`お知らせ「${n.title || n.id}」: ${problems.join('、')}`);
    }
    seen.add(n.id);
    valid.push(n);
  }
  return valid.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// 本文中の **太字** と [文字](URL)
function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/|#)[^)\s]*)\)/g, (_, t, u) => `<a href="${u}"${linkAttrs(u)}>${t}</a>`);
}

// 記事本文のブロック（pom-inc.co.jp・retopo.cafe と同じ種類。README の「お知らせの書き方」を参照）
function renderBlock(b) {
  if (typeof b === 'string') return `<p>${inline(b)}</p>`;
  switch (b.type) {
    case 'lead': return `<p class="lead-text">${inline(b.text)}</p>`;
    case 'p': return `<p>${inline(b.text)}</p>`;
    case 'h2': return `<h2>${esc(b.text)}</h2>`;
    case 'h3': return `<h3>${esc(b.text)}</h3>`;
    case 'quote': return `<blockquote><p>${inline(b.text)}</p>${b.cite ? `<cite>${esc(b.cite)}</cite>` : ''}</blockquote>`;
    case 'ul': return `<ul>${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`;
    case 'ol': return `<ol>${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</ol>`;
    case 'img': return `<figure><img src="${esc(b.src)}" alt="${esc(b.alt || b.caption || '')}" loading="lazy">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>`;
    case 'table': return `<table class="acc">${b.rows.map((r) => `<tr><th>${esc(r[0])}</th><td>${inline(r[1])}</td></tr>`).join('')}</table>`;
    case 'note': return `<div class="notice"><b>ご注意</b><p>${inline(b.text)}</p></div>`;
    case 'hr': return '<hr>';
    case 'buttons': return `<div class="btns">${b.items.map((x) => `<a class="btn${x.style === 'outline' ? ' btn-line' : ''}" href="${esc(x.url)}"${linkAttrs(x.url)}>${esc(x.text)}</a>`).join('')}</div>`;
    default:
      console.warn(`  ⚠ 記事の本文で、知らない種類のブロックを飛ばしました: ${b.type}`);
      return '';
  }
}

function excerpt(n) {
  if (n.description) return n.description;
  const first = (n.body || []).map((b) => (typeof b === 'string' ? b : ['lead', 'p'].includes(b.type) ? b.text : '')).find(Boolean) || '';
  return first.replace(/\*\*|\[|\]\([^)]*\)/g, '').slice(0, 110);
}

const genreTag = (n, site) => `<span class="cat c-${n.genre}">${esc(site.genres[n.genre])}</span>`;

// お知らせの一覧。limit を付けると、それより後ろの行は最初は隠しておく（絞り込みで表示する）
function newsList(items, site, today, { id = '', limit = 0 } = {}) {
  if (!items.length) return '<p class="empty">お知らせはまだありません。</p>';
  const isNew = (d) => (today - new Date(`${d}T00:00:00+09:00`).getTime()) / 864e5 < site.newDays;
  const lis = items.map((n, i) =>
    `<li data-genre="${n.genre}"${limit && i >= limit ? ' hidden' : ''}><a href="/news/${n.id}/">` +
    `<time datetime="${n.date}">${dateLabel(n.date)}</time>${genreTag(n, site)}` +
    `<span class="t">${esc(n.title)}${isNew(n.date) ? '<span class="new">NEW</span>' : ''}</span></a></li>`).join('\n          ');
  return `<ul class="news"${id ? ` id="${id}"` : ''}${limit ? ` data-limit="${limit}"` : ''}>\n          ${lis}\n        </ul>`;
}

// ---------------------------------------------------------------
// 撮影・取材のご依頼（/shooting/）。実績はお知らせ（news.json）から自動で並べる
//   撮影実績 … タイトルに「撮影に店内をご利用」を含むメディア掲載
//   取材実績 … それ以外のメディア掲載
// ---------------------------------------------------------------
function shootingParts(site, news) {
  const sh = site.shooting;
  if (!sh) return {};
  const li = (n, tag = true) => `<li><a href="/news/${n.id}/"><time datetime="${n.date}">${dateLabel(n.date)}</time>${tag ? genreTag(n, site) : ''}<span class="t">${esc(n.title)}</span></a></li>`;
  const isShoot = (n) => n.genre === 'press' && n.title.includes('撮影に店内');
  const shoots = news.filter(isShoot);
  const press = news.filter((n) => !isShoot(n) && n.genre === 'press');
  const ul = (items, tag) => `<ul class="news">\n          ${items.map((n) => li(n, tag)).join('\n          ')}\n        </ul>`;
  const mag = (t) => (t.match(/『(.+?)』/) || [])[1];
  const shootNames = [...new Set(shoots.map((n) => mag(n.title)).filter(Boolean))];
  const mailto = (subject, items) => `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(['お世話になっております。', '', ...items.map((x) => `・${x}：`), ''].join('\n'))}`;
  const lis = (items) => items.map((x) => `<li>${esc(x)}</li>`).join('');
  // ギャラリー：大きな写真1枚と、下に小さい写真の帯（動きは casse.js）。
  // 小さい写真のリンク先が大きい写真なので、JS が動かなくても写真は見られる
  const first = sh.gallery[0];
  const gallery = `<div class="sg" data-gallery>
    <figure class="sg-stage">
      <button type="button" class="sg-open" aria-label="写真を大きく表示">${img(first, '(max-width: 760px) 100vw, 1200px')}</button>
      <button type="button" class="sg-nav sg-prev" aria-label="前の写真"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>
      <button type="button" class="sg-nav sg-next" aria-label="次の写真"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>
      <figcaption class="sg-cap"><span class="t">${esc(first.alt)}</span><span class="n">1 / ${sh.gallery.length}</span></figcaption>
    </figure>
    <ul class="sg-thumbs" aria-label="写真の一覧">
      ${sh.gallery.map((p, i) => {
        const o = photo(p.file);
        return `<li><a href="${o.src}" data-srcset="${o.srcset}" data-alt="${esc(p.alt)}"${i === 0 ? ' aria-current="true"' : ''}>${img(p, '88px', { alt: '' })}</a></li>`;
      }).join('\n      ')}
    </ul>
  </div>`;
  return {
    leadHtml: sh.lead.map(esc).join('<br>'),
    photo: img(sh.photo, '(min-width: 761px) 50vw, 100vw', { lazy: false, priority: true }),
    gallery,
    timesHtml: sh.times.map((t) => `<li>${esc(t)}</li>`).join('<li class="sep" aria-hidden="true">/</li>'),
    prices: sh.prices.map((x) => `<div><dt>${esc(x.label)}</dt><dd>${esc(x.value)}<small>（税抜）</small></dd></div>`).join('\n        '),
    features: sh.features.map((x) => `<div><dt>${icon(x.icon)}${esc(x.label)}</dt><dd>${esc(x.text)}</dd></div>`).join('\n          '),
    flow: sh.flow.map((x, i) => `<li><span class="n">${i + 1}</span><span><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></span></li>`).join(''),
    priceNotes: sh.priceNotes.map((x, i) => `<li><span class="k">※${i + 1}</span>${esc(x)}</li>`).join(''),
    pressTopics: sh.pressTopics.map((x) => `<li><span class="t">${esc(x.topic)}</span><span class="m">${esc(x.media)}</span></li>`).join(''),
    mailItems: lis(sh.mailItems),
    mailHref: mailto(sh.mailSubject, sh.mailItems),
    pressMailItems: lis(sh.pressMailItems),
    pressMailHref: mailto(sh.pressMailSubject, sh.pressMailItems),
    shootList: ul(shoots, false),
    pressList: ul(press, false),
    shootNames: shootNames.map((x) => `『${esc(x)}』`).join(''),
    shootCount: shoots.length,
    pressCount: press.length
  };
}

// ---------------------------------------------------------------
// 構造化データ（検索エンジン向け）
// ---------------------------------------------------------------
function cafeJsonLd(site) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'CafeOrCoffeeShop',
    name: site.fullName,
    url: `${site.url}/`,
    image: `${site.url}/assets/img/common/ogp.jpg`,
    description: site.description,
    email: site.email,
    hasMenu: `${site.url}/menu/`,
    address: { '@type': 'PostalAddress', postalCode: site.store.zip, addressCountry: 'JP', addressRegion: site.store.region, addressLocality: site.store.locality, streetAddress: site.store.street },
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: site.store.opens, closes: site.store.closes }],
    paymentAccepted: 'クレジットカード, PayPay, 交通系IC, QUICPay, iD',
    sameAs: [`https://www.instagram.com/${site.instagram}/`],
    parentOrganization: { '@type': 'Organization', name: '株式会社ポム', url: 'https://pom-inc.co.jp/' }
  };
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

// 記事のシェア画像：本文の最初の画像（img ブロック）。なければ共通の OGP 画像
function articleImage(n, site) {
  const im = (n.body || []).find((b) => b && b.type === 'img' && b.src);
  if (!im) return `${site.url}/assets/img/common/ogp.jpg`;
  if (isExternal(im.src)) return im.src;
  // WebP は SNS によって表示されないので、同じ名前の .jpg（1200×630 推奨）があればそちらを使う
  const jpg = im.src.replace(/\.webp$/, '.jpg');
  if (jpg !== im.src && fss.existsSync(path.join(SRC, jpg.replace(/^\//, '')))) return `${site.url}${jpg}`;
  return `${site.url}${im.src}`;
}

function articleJsonLd(n, site, url) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: n.title,
    datePublished: n.date,
    dateModified: n.updated || n.date,
    mainEntityOfPage: url,
    image: [articleImage(n, site)],
    publisher: { '@type': 'Organization', name: site.fullName }
  };
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

// ---------------------------------------------------------------
// トップとメニューページの部品
// ---------------------------------------------------------------
// 料金の表。en を付けると英語を小さく添える（メニューページは日英共通）
function chargeTable(charge, { en = false, enOnly = false } = {}) {
  const bi = (ja, e) => (enOnly ? esc(e || ja) : en && e ? `${esc(ja)}<span class="en" lang="en">${esc(e)}</span>` : esc(ja));
  const cols = charge.columns.map((c, i) => `<th scope="col">${bi(c, (charge.columnsEn || [])[i])}</th>`).join('');
  const head = `<tr><th scope="col"><span class="vh">${enOnly ? 'Type' : '区分'}</span></th>${cols}</tr>`;
  const rows = charge.rows.map((r) => `<tr><th scope="row">${bi(r.label, r.labelEn)}</th>${r.prices.map((p) => `<td>${yen(p)}</td>`).join('')}</tr>`).join('\n              ');
  return `<div class="table-wrap"><table class="charge${en ? ' charge-bi' : ''}">\n            <thead>${head}</thead>\n            <tbody>\n              ${rows}\n            </tbody>\n          </table></div>`;
}

function menuSections(menu) {
  return menu.categories.map((c) => {
    const strip = c.items.map((it) => {
      const pic = it.photo
        ? img({ file: it.photo }, '132px', { alt: '', pos: it.photoPosition })
        : '<span class="ph-empty">写真を準備中</span>';
      return `<li>${pic}<span class="cap">${esc(it.name)}</span></li>`;
    }).join('');
    const rows = c.items.map((it) =>
      `<li><span class="nm"><b>${esc(it.name)}</b><span class="en" lang="en">${esc(it.en)}</span></span>` +
      `<span class="pr"><span class="vh">店内 </span>${yen(it.in)}</span>` +
      `<span class="pr pr-out"><span class="vh">テイクアウト </span>${yen(it.out)}</span></li>`).join('\n              ');
    return `<section class="menu-cat" id="${esc(c.id)}">
          <div class="menu-cat-head">
            <h2>${esc(c.name)}</h2>
            <p class="en" lang="en">${esc(c.en)}</p>
            ${c.note ? `<p class="note">${esc(c.note)}${c.noteEn ? ` <span lang="en">${esc(c.noteEn)}</span>` : ''}</p>` : ''}
          </div>
          <div class="menu-cat-body">
            ${menu.showPhotos ? `<ul class="strip" aria-label="${esc(c.name)}の写真">${strip}</ul>` : ''}
            <div class="menu-cols" aria-hidden="true"><span>店内<span lang="en">Eat-in</span></span><span>テイクアウト<span lang="en">To go</span></span></div>
            <ul class="menu-items">
              ${rows}
            </ul>
          </div>
        </section>`;
  }).join('\n        ');
}

// ---------------------------------------------------------------
// 日本語・英語を1つのリストから作る部品（楽しみ方・ご利用案内・営業時間・フッター）
// 英語（titleEn など）が抜けていたら書き出しを止めて知らせる
// ---------------------------------------------------------------
function pick(x, key, lang, where) {
  if (lang === 'ja') return x[key];
  const v = x[`${key}En`];
  if (!v) throw new Error(`${where}「${x[key]}」の英語（${key}En）がありません（src/_data/site.json）`);
  return v;
}
const stepList = (steps, lang) => steps.map((x, i) =>
  `<li><span class="step-head"><span class="num">${i + 1}</span>${x.icon ? icon(x.icon, 28) : ''}</span><h3>${esc(pick(x, 'title', lang, '楽しみ方'))}</h3><p>${esc(pick(x, 'text', lang, '楽しみ方'))}</p></li>`).join('\n          ');
const infoList = (info, lang) => info.map((x) =>
  `<div><dt>${icon(x.icon)}${esc(pick(x, 'label', lang, 'ご利用案内'))}</dt><dd>${esc(pick(x, 'text', lang, 'ご利用案内'))}</dd></div>`).join('\n          ');
const hoursText = (st, lang) => (lang === 'en'
  ? `${st.opens}–${st.closes} (last order ${st.lastOrder})`
  : `${st.opens}〜${st.closes}（L.O. ${st.lastOrder}）`);

// メニューの品を名前で探す（トップの抜粋の価格は menu.json から引く）
function menuItem(menu, name) {
  for (const c of menu.categories) for (const it of c.items) if (it.name === name) return it;
  throw new Error(`トップのメニュー抜粋「${name}」が menu.json に見つかりません（品名を同じ文字で書いてください）`);
}

let SITE;
function footHtml(lang) {
  const site = SITE;
  const f = site.footer[lang];
  const sister = lang === 'en' ? site.store.sister.nameEn : site.store.sister.name;
  const a = (url, text) => `<a href="${esc(url)}"${linkAttrs(url)}>${esc(text)}</a>`;
  return lang === 'en'
    ? `<p>${esc(f.contact)}: <a href="mailto:${esc(site.email)}">${esc(site.email)}</a> (${esc(f.noReserve)})</p>\n      <p>${esc(f.jasrac)} ${esc(site.store.jasrac)} / ${esc(f.sister)}: ${a(site.store.sister.url, sister)}</p>\n      <p>${esc(f.company)} ${a('https://pom-inc.co.jp/', f.companyName)}</p>`
    : `<p><a href="/shooting/">${esc(f.contact)}</a>：<a href="mailto:${esc(site.email)}">${esc(site.email)}</a>（${esc(f.noReserve)}）</p>\n      <p>${esc(f.jasrac)} ${esc(site.store.jasrac)}号／${esc(f.sister)} ${a(site.store.sister.url, sister)}</p>\n      <p>${esc(f.company)}：${a('https://pom-inc.co.jp/', f.companyName)}</p>`;
}

// ---------------------------------------------------------------
// 書き出し
// ---------------------------------------------------------------
async function build() {
  const t0 = Date.now();
  const site = await readJSON(path.join(SRC, '_data/site.json'));
  SITE = site;
  const media = (await readJSON(path.join(SRC, '_data/media.json'))).items || [];
  const menu = await readJSON(path.join(SRC, '_data/menu.json'));
  const news = await loadNews(site);

  const partials = {};
  for (const f of await fs.readdir(path.join(SRC, '_partials'))) {
    partials[path.basename(f, '.html')] = await fs.readFile(path.join(SRC, '_partials', f), 'utf8');
  }
  const layouts = {};
  for (const f of await fs.readdir(path.join(SRC, '_layouts'))) {
    layouts[path.basename(f, '.html')] = await fs.readFile(path.join(SRC, '_layouts', f), 'utf8');
  }

  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });
  await copyDir(path.join(SRC, 'assets'), path.join(OUT, 'assets'));
  await copyDir(path.join(SRC, 'static'), OUT);

  const ig = `https://www.instagram.com/${site.instagram}/`;

  // メディア掲載の帯。途切れなく流すために同じ並びを2回並べる（2回目は読み上げない）
  const mediaItem = (m, hidden) => `<li${hidden ? ' aria-hidden="true"' : ''}>${m.logo
    ? `<img src="/assets/img/media/${esc(m.logo)}" alt="${hidden ? '' : esc(m.name)}" height="28" loading="lazy" decoding="async">`
    : `<b>${esc(m.name)}</b>`}${m.kind ? `<small>${esc(m.kind)}</small>` : ''}</li>`;
  let half = [...media];
  while (half.length && half.length < 8) half = half.concat(media);
  const mediaTrack = media.length
    ? `<ul class="marquee-track" data-nobreak>${half.map((m, i) => mediaItem(m, i >= media.length)).join('')}${half.map((m) => mediaItem(m, true)).join('')}</ul>`
    : '<p class="empty">ただいま準備中です。</p>';

  const shared = {
    site,
    ig,
    build: { version: t0.toString(36), year: new Date().getFullYear() },
    news: {
      latest: newsList(news, site, t0, { id: 'news-latest', limit: 5 }),
      all: newsList(news, site, t0, { id: 'news-all' }),
      filters: [['all', 'すべて'], ...Object.entries(site.genres).filter(([k]) => k === 'all' || news.some((n) => n.genre === k))]
        .map(([k, v], i) => `<button type="button" data-genre="${k}" aria-pressed="${i === 0}">${esc(v)}</button>`).join('\n          ')
    },
    media: { track: mediaTrack },
    charge: { tableBi: chargeTable(site.charge, { en: true }) },
    store: {
      ...site.store,
      accessHtml: site.store.access.map(esc).join('<br>'),
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.store.mapQuery)}`
    },
    shooting: shootingParts(site, news),
    menu: {
      updated: menu.updated,
      chips: menu.categories.map((c) => `<a href="#${esc(c.id)}">${esc(c.name)}<span lang="en">${esc(c.en)}</span></a>`).join('\n          '),
      sections: menuSections(menu)
    }
  };

  const sitemap = [];

  // 日本語と英語で変わる部分（ナビ・言語切り替え・フッター）
  const navHtml = (list, sep) => list.map((n) => `<a href="${esc(n.href)}">${esc(n.label)}</a>`).join(sep);
  function langParts(lang) {
    const en = lang === 'en';
    const nav = en ? site.en.nav : site.nav;
    return {
      lang,
      locale: en ? 'en_US' : 'ja_JP',
      skip: en ? 'Skip to content' : '本文へ移動',
      navLabel: en ? 'Main menu' : 'メインメニュー',
      navHeader: navHtml(nav, '\n      '),
      navFab: [navHtml(nav, '\n  '), `<a class="ig" href="${ig}" target="_blank" rel="noopener" lang="en">Instagram</a>`].join('\n  '),
      fabOpen: en ? 'Open menu' : 'メニューを開く',
      fabClose: en ? 'Close menu' : 'メニューを閉じる',
      langSwitch: `<div class="lang" role="group" aria-label="${en ? 'Language' : '表示する言語'}"><a href="/" lang="ja"${en ? '' : ' aria-current="true"'}>JP</a><a href="/en/" lang="en"${en ? ' aria-current="true"' : ''}>EN</a></div>`,
      foot: footHtml(lang)
    };
  }

  // トップ（/）と英語ページ（/en/）で使う文章・写真。テンプレートは同じで、ここだけが言語で変わる
  function homeParts(lang) {
    const en = lang === 'en';
    const ui = site.ui[lang];
    const alt = (p) => (en ? p.altEn || p.alt : p.alt);
    const pic = (p, sizes, opts = {}) => img(p, sizes, { ...opts, alt: alt(p) });
    const lines = (list) => list.map(esc).join(en ? ' <br>' : '<br>');
    return {
      ui,
      heroTitleHtml: lines(ui.heroTitle),
      heroLeadHtml: lines(en ? site.en.hero.lead : site.hero.lead),
      heroImg: pic(site.hero, '(max-width: 760px) calc(100vw - 96px), 1180px', { lazy: false, priority: true }),
      aboutTitleHtml: en ? esc(site.en.about.title) : lines(site.about.title),
      aboutText: en ? site.en.about.text : site.about.text,
      aboutImg: pic(site.about.photo, '(max-width: 760px) calc(100vw - 40px), 560px'),
      steps: stepList(site.steps, lang),
      chargeNote: en ? site.en.charge.note : site.charge.note,
      chargeTable: chargeTable(site.charge, { enOnly: en }),
      chargeFootnote: en ? `${site.charge.footnoteEn} ${site.charge.takeoutNoteEn}` : site.charge.footnote + site.charge.takeoutNote,
      menuText: en ? site.en.menu.text : site.menuPreview.text,
      menuImg: pic(site.menuPreview.photo, '(max-width: 760px) calc(100vw - 40px), 600px'),
      menuItems: site.menuPreview.items.map((x) => {
        const it = menuItem(menu, x.item);
        const name = en ? it.en.split(' ／ ')[0] : x.label || it.name;
        return `<li><span>${esc(name)}</span><span class="pr">${yen(it.in)}</span></li>`;
      }).join('\n            '),
      info: infoList(site.info, lang),
      gallery: site.gallery.map((g, i) => pic(g, i === 0 ? '(max-width: 760px) calc(100vw - 40px), 400px' : '(max-width: 760px) calc(100vw - 40px), 800px', { cls: i === 0 ? 'g-tall' : 'g-wide' })).join('\n        '),
      addressHtml: en ? esc(site.en.store.address) : `〒${esc(site.store.zip)}<br>${esc(site.store.address)}`,
      accessHtml: lines(en ? site.en.store.access : site.store.access).replace(/ <br>/g, '<br>'),
      hoursHtml: `${esc(hoursText(site.store, lang))}<br>${esc(en ? site.en.store.holiday : `${ui.holiday} ${site.store.holiday}`)}`,
      jasracText: en ? site.store.jasrac : `${site.store.jasrac}号`,
      storeImg: pic(site.store.photo, '(max-width: 760px) calc(100vw - 40px), 600px')
    };
  }

  function pageCtx(meta, urlPath, extra = {}) {
    const isTop = urlPath === '/';
    return {
      ...shared,
      page: {
        ...langParts(meta.lang || 'ja'),
        t: homeParts(meta.lang || 'ja'),
        fullTitle: meta.fullTitle || (isTop ? `${site.fullName}｜${site.catch}` : `${meta.title}｜${site.name}`),
        description: meta.description || site.description,
        url: `${site.url}${urlPath}`,
        ogType: meta.ogType || (isTop ? 'website' : 'article'),
        robots: meta.noindex ? '<meta name="robots" content="noindex">' : '',
        jsonld: meta.jsonld || '',
        image: meta.image || `${site.url}/assets/img/common/ogp.jpg`,
        current: meta.current || '',
        home: meta.lang === 'en' ? '/en/' : '/',
        hreflang: ['/', '/en/'].includes(urlPath) ? `<link rel="alternate" hreflang="ja" href="${site.url}/">\n<link rel="alternate" hreflang="en" href="${site.url}/en/">\n<link rel="alternate" hreflang="x-default" href="${site.url}/">` : ''
      },
      ...extra
    };
  }

  async function writePage(urlPath, html) {
    const file = urlPath.endsWith('/') ? path.join(OUT, urlPath, 'index.html') : path.join(OUT, urlPath);
    await fs.mkdir(path.dirname(file), { recursive: true });
    // 日本語を文節の切れ目で改行させる（lib/phrase.mjs）
    await fs.writeFile(file, addPhraseBreaks(html));
  }

  // 1) src/pages の各ページ
  const pageFiles = (await walk(path.join(SRC, 'pages'))).filter((f) => f.endsWith('.html'));
  for (const file of pageFiles) {
    const rel = path.relative(path.join(SRC, 'pages'), file).split(path.sep).join('/');
    const { meta, body } = parseFrontMatter(await fs.readFile(file, 'utf8'), rel);
    const urlPath = meta.path || '/' + rel.replace(/index\.html$/, '');
    if (meta.cafeJsonLd) meta.jsonld = cafeJsonLd(site);
    const ctx = pageCtx(meta, urlPath);
    const content = render(body, ctx, partials, `pages/${rel}`);
    await writePage(urlPath, render(layouts.default, { ...ctx, content }, partials, '_layouts/default.html'));
    if (!meta.noindex) sitemap.push({ loc: `${site.url}${urlPath}`, lastmod: new Date(t0).toISOString().slice(0, 10) });
  }

  // 2) お知らせの記事ページ（/news/記事ID/）
  const articleTpl = await fs.readFile(path.join(SRC, '_templates/news-article.html'), 'utf8');
  for (const n of news) {
    const urlPath = `/news/${n.id}/`;
    const meta = { title: n.title, description: excerpt(n), ogType: 'article', image: articleImage(n, site), jsonld: articleJsonLd(n, site, `${site.url}${urlPath}`) };
    const ctx = pageCtx(meta, urlPath, {
      article: {
        title: n.title,
        date: n.date,
        dateLabel: dateLabel(n.date),
        updated: n.updated ? `<span class="upd">（更新 ${dateLabel(n.updated)}）</span>` : '',
        genreName: site.genres[n.genre],
        tag: genreTag(n, site),
        body: (n.body || []).map(renderBlock).join('\n')
      }
    });
    const content = render(articleTpl, ctx, partials, '_templates/news-article.html');
    await writePage(urlPath, render(layouts.default, { ...ctx, content }, partials, '_layouts/default.html'));
    sitemap.push({ loc: `${site.url}${urlPath}`, lastmod: n.updated || n.date });
  }

  // 3) サイトマップ
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    sitemap.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n') + '\n</urlset>\n';
  await fs.writeFile(path.join(OUT, 'sitemap.xml'), xml);

  // 4) お知らせのデータ（/news.json）。pom-inc.co.jp がこれを読みにきて、会社サイトのお知らせにも載せる
  await fs.writeFile(path.join(OUT, 'news.json'), JSON.stringify({ updated: new Date(t0).toISOString(), items: news }, null, 1));

  // 5) RSS（旧サイトの /feed からも転送する）
  const rfc = (d) => new Date(`${d}T09:00:00+09:00`).toUTCString();
  const rss = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n' +
    `<title>${esc(site.fullName)}</title>\n<link>${site.url}/</link>\n<description>${esc(site.catch)}</description>\n<language>ja</language>\n` +
    news.slice(0, 20).map((n) => `<item><title>${esc(n.title)}</title><link>${site.url}/news/${n.id}/</link><guid>${site.url}/news/${n.id}/</guid><pubDate>${rfc(n.date)}</pubDate><category>${esc(site.genres[n.genre])}</category><description>${esc(excerpt(n))}</description></item>`).join('\n') +
    '\n</channel>\n</rss>\n';
  await fs.writeFile(path.join(OUT, 'feed.xml'), rss);

  console.log(`書き出し完了: ${pageFiles.length}ページ＋お知らせ${news.length}件（${Date.now() - t0}ms）→ dist/`);
}

// ---------------------------------------------------------------
// 確認用サーバー（node build.mjs --serve）
// ---------------------------------------------------------------
function serve(port = 8080) {
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
  http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(OUT, path.normalize(p));
    if (!file.startsWith(OUT)) { res.writeHead(403); return res.end(); }
    try {
      const data = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(await fs.readFile(path.join(OUT, '404.html')).catch(() => 'Not Found'));
    }
  }).listen(port, () => console.log(`確認用サーバー: http://localhost:${port}/`));
}

build()
  .then(() => { if (process.argv.includes('--serve')) serve(); })
  .catch((e) => { console.error('\n書き出しに失敗しました:\n' + e.message); process.exit(1); });
