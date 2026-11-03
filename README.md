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
| `/menu/` | メニューと料金（旧メニューPDFのQRコードの転送先）。日本語と英語を併記し、英語ページからもここにつなぐ |
| `/news/` | お知らせ一覧（カテゴリで絞り込み） |
| `/news/記事ID/` | お知らせの記事 |
| `/en/` | 英語の案内（次のプルリクエストで追加）。メニューは `/menu/` を日英共通で使う |

## ファイル

| 場所 | 中身 |
| --- | --- |
| `src/_data/site.json` | 店の情報・ナビ・楽しみ方・料金・ご利用案内・フッターの文言・トップの写真と文章（日本語と英語） |
| `src/_data/menu.json` | メニューと価格（カテゴリごと）。品目ごとの写真もここで指定 |
| `src/_data/news.json` | お知らせ |
| `src/_data/media.json` | メディア掲載の帯（番組名・雑誌名） |
| `src/_partials/` | 共通部品（head・ヘッダー・フッター・スマホのカセット型メニュー） |
| `src/_templates/news-article.html` | お知らせ記事ページのひな形 |
| `src/pages/` | トップ・メニュー・お知らせ一覧・英語ページ・404 |
| `src/assets/css/casse.css` | 見た目（色は先頭の変数を使う） |
| `src/assets/js/casse.js` | カセット型メニュー・お知らせの絞り込み・クリック計測 |
| `src/assets/img/photos/` | 写真（WebP）。`名前.webp` と、小さく出すとき用の `名前-400.webp` |
| `src/static/` | `.htaccess`・ファビコン・robots.txt など（dist/ 直下にコピー） |

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
