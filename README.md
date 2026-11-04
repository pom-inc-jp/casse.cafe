# casse.cafe

カセットテープカフェ CASSE（カッセ）のサイト。2026年11月に WordPress から静的サイトに切り替えて公開中。しくみは retopo.cafe・pom-inc.co.jp と同じ。

```
node build.mjs           # dist/ に書き出す
node build.mjs --serve   # 書き出して http://localhost:8080 で確認
```

Node.js 18 以上だけで動く（npm install 不要）。

## ページ

| URL | 中身 |
| --- | --- |
| `/` | トップ（メディア掲載の帯・お知らせ・楽しみ方・料金・ご利用案内・メニューの抜粋・アクセス） |
| `/menu/` | メニューと料金（旧メニューPDFのQRコードの転送先）。日本語と英語を併記し、英語ページからもここにつなぐ |
| `/news/` | お知らせ一覧（カテゴリで絞り込み） |
| `/news/記事ID/` | お知らせの記事 |
| `/en/` | 英語の案内。メニューは `/menu/` を日英共通で使う |
| `/shooting/` | 撮影・取材のご依頼（撮影は場所の貸し出し。取材側は紫） |

## ファイル

| 場所 | 中身 |
| --- | --- |
| `src/_data/site.json` | 店の情報・ナビ・楽しみ方・料金・ご利用案内・フッターの文言・トップの写真と文章（日本語と英語） |
| `src/_data/menu.json` | メニューと価格（カテゴリごと）。品目ごとの写真もここで指定 |
| `src/_data/news.json` | お知らせ |
| `src/_data/media.json` | メディア掲載の帯（番組名・雑誌名） |
| `src/_partials/` | 共通部品（head・ヘッダー・フッター・スマホのカセット型メニュー）。`home-hero.html`・`home-body.html` はトップと英語ページで共通の本文（言葉は site.json の `ui` などから言語ごとに入る） |
| `src/_templates/news-article.html` | お知らせ記事ページのひな形 |
| `src/pages/` | トップ・メニュー・お知らせ一覧・英語ページ・撮影・取材・404 |
| `src/assets/css/casse.css` | 見た目（色は先頭の変数を使う） |
| `src/assets/js/casse.js` | カセット型メニュー・お知らせの絞り込み・クリック計測 |
| `src/assets/img/photos/` | 写真（WebP）。`名前.webp` と、小さく出すとき用の `名前-400.webp` |
| `src/static/` | `.htaccess`・ファビコン・robots.txt など（dist/ 直下にコピー） |
| `lib/phrase.mjs` `lib/budoux/` | 日本語を文節の切れ目で改行させる（pom-inc.co.jp・retopo.cafe と同じ。BudouX は同梱の外部ライブラリなので書き換えない） |

## 店の情報を変えるとき（`src/_data/site.json`）

同じ情報は1か所にだけ書く。書き出すときに、日本語ページ・英語ページ・メニューページ・検索エンジン向けのデータへ配る。

| 変えたいもの | 直す場所 |
| --- | --- |
| 営業時間 | `store.opens`・`store.closes`・`store.lastOrder`（日本語と英語の表記はここから作る） |
| 住所 | `store.address`（表示）と `store.region`・`store.locality`・`store.street`（検索エンジン向け）。英語の住所は `en.store.address` |
| 料金 | `charge.rows` の `prices`。注記は `charge.footnote`（英語は `footnoteEn`） |
| 楽しみ方・ご利用案内 | `steps`・`info`。1つの項目に日本語（`title`・`text`／`label`・`text`）と英語（`titleEn`・`textEn`／`labelEn`・`textEn`）を一緒に書く。英語が抜けていると書き出しが止まって知らせる |
| トップのメニュー抜粋 | `menuPreview.items` に menu.json の品名を書く。価格は menu.json から自動で引く（品名が見つからないと書き出しが止まる） |
| フッターの文言 | `footer.ja`・`footer.en` |

## メニューを変えるとき（`src/_data/menu.json`）

価格は税込の数字で、`in` が店内、`out` がテイクアウト（テイクアウトなしは `null`）。品名（`name`）を変えたら、トップの抜粋（site.json の `menuPreview.items`）も同じ名前に直す。

写真を付けるときは、下の「写真を足すとき」の手順で WebP を作って `src/assets/img/photos/` に置き、品目に `"photo": "ファイル名"` を書く（`.webp` は付けない）。正方形に切り抜くので、写したいものが端にあるときは `"photoPosition": "50% 80%"` のように位置を指定する（左右・上下の順。`50% 80%` は「横は真ん中、縦は下寄り」）。写真がない品は「写真を準備中」の枠が出る。

写真の横スクロールは、menu.json の `"showPhotos"` で出し分ける。写真がそろうまでは `false`（隠す）にしておき、そろったら `true` にしてプルリクエストを出す。

## 写真を足すとき

写真は WebP にして、大きい版と小さい版（横400px）の2枚を置く。小さい版があると、スマホやメニューの小さな枠ではそちらを読み込むので軽くなる。

1. ファイル名を決める（半角英小文字・数字・ハイフン。例：`iced-latte`）
2. Google の変換ツール `cwebp` で2枚作る（Mac は `brew install webp` で入る）

   ```
   # 大きい版：横長の写真は長い辺を1600pxに（縦長なら -resize 0 1600）
   cwebp -q 80 -resize 1600 0 元の写真.jpg -o src/assets/img/photos/iced-latte.webp
   # 小さい版：横400px
   cwebp -q 78 -resize 400 0 元の写真.jpg -o src/assets/img/photos/iced-latte-400.webp
   ```

   ツールを入れたくない場合は、ブラウザで使える Squoosh（https://squoosh.app/）で同じ設定にして保存してもよい。Claude に写真を渡せば、変換して置くところまで行う
3. 使う場所に名前を書く（メニューなら menu.json の `photo`、トップの写真なら site.json の `file`）
4. `node build.mjs` で書き出す。名前を書き間違えていると「写真が見つかりません」と出て止まる
5. iPhone の写真（HEIC）はそのままでは使えないので、先に JPEG で書き出してから変換する

## お知らせの書き方

`src/_data/news.json` の `items` に追加する。書き方は pom-inc.co.jp・retopo.cafe と同じ。

| 項目 | 書き方 |
| --- | --- |
| id | 半角英小文字・数字・ハイフン。URL になる（`/news/2026summer/`）。公開後は変えない |
| date | `2026-12-01` の形。`updated` を書くと更新日も出る |
| store | いつも `"casse"` |
| genre | `announce`（お知らせ）`press`（メディア掲載）`collab`（コラボ）`campaign`（イベント）`other`（その他） |
| title | 一覧と記事の見出し |
| body | 本文。文字だけの行は段落になる。`lead`・`h2`・`ul`・`img`・`table`・`note`・`buttons` などのブロックが使える（build.mjs の `renderBlock` を参照） |

`genre` が `announce` 以外の記事は、pom-inc.co.jp のお知らせにも自動で載る（書き出し時に `/news.json` を公開し、会社サイトが読みに来る）。

## 改行の位置（文節）

書き出しのとき `lib/phrase.mjs` が日本語を文節に区切り、切れ目に `<wbr>` を入れる（CSS は `word-break: keep-all`）。HTML に `<wbr>` を手で書かない。

- メディア掲載の帯のように1行のまま見せる部分は、要素に `data-nobreak` を付ける（付け忘れると帯が何行にも崩れる）
- 切りたくない語句は `<span class="nb">…</span>` で囲む

## 旧サイトからの転送（`src/static/.htaccess`）

- `/wp-content/uploads/` の中のPDF → `/menu/`（印刷物のQRコード対策。CASSEのメニュー3つと、RECOCOの旧メニュー5つ）
- `/archives/news/記事名` → `/news/記事名/`（旧サイトの記事名と `id` をそろえている：open・2025winter・2026spring・2026summer）
- `/ブログページ`・`/archives/...`・`/category/` などの一覧・`?p=123` → トップ
- `/feed` → `/feed.xml`、`/wp-sitemap*.xml` → `/sitemap.xml`
- `/wp-login.php`・`/wp-admin` など → 404

## 公開

`.github/workflows/deploy.yml`。中身は店舗サイト共通のワークフロー（[pom-inc-jp/site-tools](https://github.com/pom-inc-jp/site-tools) の `deploy-static.yml@v1`）で、ここには動かすタイミングと、CASSEだけの設定（残すフォルダ・切り替えの変数）だけを書いている。`main` に変更が入ると書き出し、Xserver の公開フォルダへ rsync で反映する。公開の仕組み自体を直すときは site-tools を直す（README 参照）。

- 公開先の接続情報は組織（pom-inc-jp）の Secrets を使う（site-tools の README）。このリポジトリの環境 `production` に同じ名前の Secrets があると、そちらが優先される
- 本番に切り替え済み（変数 `CASSE_LIVE` が `true`）。`main` に入るたび、と毎日 3:10（日本時間）に反映される。反映の前に毎回「試し（dry-run）」の一覧を実行結果に出す
- 反映を一時的に止めたいときは `CASSE_LIVE` を `false` にする（試しだけになる）。その間に1回だけ反映したいときは、Actions → 公開 → Run workflow で mode を `deploy` にする
- 消さないもの：`casse_movie_app/` など `_movie_app` で終わるフォルダ、mp4 が入っているフォルダ、`.well-known/`、`wp-content/uploads/`、検索エンジンの確認ファイル
- pom-inc.co.jp の `newsSources` に casse.cafe を追加済み。Search Console でのサイトマップ（`https://casse.cafe/sitemap.xml`）の送信は STATUS.md で管理

## 計測（Googleタグマネージャー → GA4）

GTM は `GTM-MGV4V8R6`（`site.json` の `gtmId`）。

サイトは `dataLayer` に次の2種類を送る（`src/assets/js/casse.js`）。GTM の「カスタムイベント」トリガーで受けて、GA4 のイベントタグで送る。

| イベント | いつ | 項目 |
|---|---|---|
| `link_click` | Instagram・地図・メール・外部サイトへのリンクを押したとき | `link_type`（instagram / map / mail / external）・`link_place`・`link_url`・`link_store` |
| `click_cta` | 主なボタン・メニューなどを押したとき | `cta_name`（下の表）・`cta_label`（押した文字）・`cta_place`（ページ内の場所）・`cta_url`（行き先。`?` 以降は送らない）・`cta_store` |

`cta_name` の一覧。新しいボタンを計測したいときは、HTML に `data-cta="名前"` を付けて、この表に足す。

| cta_name | どこ |
|---|---|
| shoot_entry / press_entry | トップの「撮影について」「取材について」 |
| shoot_anchor / press_anchor | 撮影・取材ページ冒頭の「撮影のご依頼」「取材のご依頼」 |
| shoot_mail / press_mail | 撮影・取材ページの問い合わせボタン |
| gallery_open / gallery_prev / gallery_next / gallery_thumb | 撮影ページのギャラリー（拡大・前・次・小さい写真） |
| menu_all | トップの「メニューをすべて見る」 |
| menu_chip | メニューページ上の目次 |
| news_more / news_filter | お知らせ一覧へ／カテゴリの絞り込み |
| nav_header / nav_fab / fab_toggle | 上のメニュー／右上のカセットのメニュー（中のリンク・開け閉め） |
| lang_switch | JP / EN の切り替え |
| logo_header / logo_footer | ロゴ（トップへ） |
| to_top | 「ページの上へ戻る」 |
