# いまの状況（casse.cafe）

新しいチャットで作業を始めるときは、まずこのファイルを読む。作業が終わったら、この表を最新に書き換える。

最終更新：2026-11-04

## 公開の状態

| 項目 | 状態 |
| --- | --- |
| 本番 | 2026年11月に WordPress から切り替えて公開中。`CASSE_LIVE` が true で、`main` に入るたび、と毎日 3:10（日本時間）に反映 |
| 公開のしくみ | site-tools の共通ワークフロー（`deploy-static.yml@v1`）。接続情報は組織の Secrets |
| 残すもの | `casse_movie_app/` など `_movie_app` で終わるフォルダ、`casse_app/`、`movie/`・`movie_app/`、mp4 の入ったフォルダ、`.well-known/`、`wp-content/uploads/`、Search Console などの確認ファイル |
| ページ | トップ・`/menu/`（日英）・`/news/`・`/en/`・`/shooting/`（撮影・取材） |
| 共通の部品 | 右下の「上へ戻る」丸ボタン（全ページ。操作が止まって1秒後に表示）、薄い水色のフッター（住所・営業時間などの一覧。JASRAC番号はフッターに出さない）、スマホのカセットのメニュー（押すと裏返って全画面メニュー、閉じるたびにA面/B面が入れ替わり、面はブラウザに記憶）。RECOCO と同じ形。リンクはサイト全体で下線なし（マウスを乗せると水色、文中のリンクは太字。アイコンのないリンクには細い線の矢印（→）を付ける。メニューの今いるページ印だけ下線） |
| お知らせ | `/news.json` を公開し、announce 以外を pom-inc.co.jp が取り込む（`newsSources` 追加済み）。`campaign` は「イベント」と表示 |
| 計測 | GTM `GTM-MGV4V8R6`（公開バージョン2）に GA4 の Google タグ（`G-Q9Y1B6JZJW`、GA4 は株式会社ポム／casse.cafe プロパティ 514856526）と、`click_cta`・`link_click` の GA4 イベントタグを入れた。サイト側は dataLayer に送るだけで、gtag は直接入れていない。GA4 にカスタム定義（cta_name・cta_label・cta_place・link_type・link_place）と探索レポート「ボタン別クリック数（click_cta）」あり |

## やりかけ・次にやること

- [ ] 二重計測：旧 WordPress（Site Kit）のタグ `GT-TWRW7L9` が RECOCO の GA4 に CASSE を送っていた。静的サイトには入れていないので、GA4 のリアルタイムで RECOCO 側に CASSE のページが出なくなったか確認する（まだ出る場合は、旧 WordPress がどこかで動いていないか調べる）
- [ ] Search Console でサイトマップ `https://casse.cafe/sitemap.xml` を送信する（済んでいたらこの行を消す）
- [ ] menu.json の `showPhotos`：写真がそろったら true にする

## 決めたこと

- アクセスの表記は「渋谷駅C1出口から徒歩4分」にそろえる（英語は 4 minutes' walk from Shibuya Station Exit C1）
- 色は黒・白・水色が基本。紫は取材側だけ、赤は特に大事な注意だけ
- 「日本初」はこのサイトでは使わない（会社サイトの紹介でだけ使う）
- 撮影は「場所の貸し出し」。雑誌は「〇〇の撮影に店内をご利用いただきました」と書く
- 旧メニューPDFのURLは印刷物のQRコードが指しているので、`/menu/` への転送を残す
- 本番に関わる変更は、プルリクエストを出して管理者の承認後にマージする
- スマホのメニュー・上へ戻る・フッターの形は RECOCO（`pom-inc-jp/recoco.cafe`）とそろえる

## 関連するサイト

| サイト | 管理 |
| --- | --- |
| pom-inc.co.jp | GitHub `pom-inc-jp/pom-inc.co.jp`。このサイトの `/news.json` を取り込む |
| site-tools | GitHub `pom-inc-jp/site-tools`。公開のワークフロー |
