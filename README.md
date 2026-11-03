# casse.cafe

カセットテープカフェ CASSE（カッセ）のサイト。WordPress をやめて、静的サイトとして書き出す。しくみは retopo.cafe・pom-inc.co.jp と同じ。

```
node build.mjs           # dist/ に書き出す
node build.mjs --serve   # 書き出して http://localhost:8080 で確認
```

Node.js 18 以上だけで動く（追加のライブラリなし）。

## ページ

| URL | 中身 |
| --- | --- |
| `/` | トップ（メディア掲載の帯・お知らせ・楽しみ方・料金・ご利用案内・メニューの抜粋・アクセス） |
| `/menu/` | メニューと料金（旧メニューPDFのQRコードの転送先） |
| `/news/` | お知らせ一覧（カテゴリで絞り込み） |
| `/news/記事ID/` | お知らせの記事 |
| `/en/` | 英語の案内（次のプルリクエストで追加） |

## ファイル

| 場所 | 中身 |
| --- | --- |
| `src/_data/site.json` | 店の情報・ナビ・楽しみ方・料金・ご利用案内・トップの写真と文章 |
| `src/_data/menu.json` | メニューと価格（カテゴリごと）。品目ごとの写真もここで指定 |
| `src/_data/news.json` | お知らせ |
| `src/_data/media.json` | メディア掲載の帯（番組名・雑誌名） |
| `src/_partials/` | 共通部品（head・ヘッダー・フッター・スマホのカセット型メニュー） |
| `src/_templates/news-article.html` | お知らせ記事ページのひな形 |
| `src/pages/` | トップ・メニュー・お知らせ一覧・404 |
| `src/assets/css/casse.css` | 見た目（色は先頭の変数を使う） |
| `src/assets/js/casse.js` | カセット型メニュー・お知らせの絞り込み・クリック計測 |
| `src/assets/img/photos/` | 写真（WebP）。`名前.webp` と、小さく出すとき用の `名前-400.webp` |
| `src/static/` | `.htaccess`・ファビコン・robots.txt など（dist/ 直下にコピー） |

## メニューを変えるとき

`src/_data/menu.json` を直す。価格は税込の数字で、`in` が店内、`out` がテイクアウト（テイクアウトなしは `null`）。

写真を付けるときは、WebP を `src/assets/img/photos/` に置き、品目に `"photo": "ファイル名"` を書く（`.webp` は付けない）。正方形に切り抜くので、写したいものが端にあるときは `"photoPosition": "50% 80%"` のように位置を指定する。写真がない品は「写真を準備中」の枠が出る。

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

## 旧サイトからの転送（`src/static/.htaccess`）

- `/wp-content/uploads/` の中のPDF → `/menu/`（印刷物のQRコード対策。CASSEのメニュー3つと、RECOCOの旧メニュー5つ）
- `/archives/news/記事名` → `/news/記事名/`（旧サイトの記事名と `id` をそろえている：open・2025winter・2026spring・2026summer）
- `/ブログページ`・`/archives/...`・`/category/` などの一覧・`?p=123` → トップ
- `/feed` → `/feed.xml`、`/wp-sitemap*.xml` → `/sitemap.xml`
- `/wp-login.php`・`/wp-admin` など → 404

## 公開

`.github/workflows/deploy.yml`。`main` に変更が入ると書き出し、Xserver の公開フォルダへ rsync で反映する。

- 公開先は GitHub の環境 `production` の Secrets（`XSERVER_HOST`・`XSERVER_USER`・`XSERVER_PATH`・`XSERVER_SSH_KEY`）
- 変数 `CASSE_LIVE` が `true` になるまでは「試し（dry-run）」だけで、消えるファイルの一覧を実行結果に出す
- 消さないもの：`casse_movie_app/` など `_movie_app` で終わるフォルダ、mp4 が入っているフォルダ、`.well-known/`、`wp-content/uploads/`、検索エンジンの確認ファイル
- 切り替えたあとは、pom-inc.co.jp の `newsSources` に casse.cafe を足し、Search Console でサイトマップ（`https://casse.cafe/sitemap.xml`）を送信する
