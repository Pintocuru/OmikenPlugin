# 保守・レビュー作業記録

## 目的
開発終了済みの本プロジェクトを安全に保守できる状態にする。新機能開発や大規模な再設計は行わず、既存仕様を維持しながら不具合と保守上の問題を把握・改善する。

## 作業ルール
- 作業対象はこのリポジトリ。関連リポジトリとの連携仕様は必要に応じて照合する。
- まず全体構成・ビルド・テスト・データ連携を把握し、その後に機能単位でレビューする。
- 不具合、未使用コード、依存関係、保守性の問題を区別して記録する。
- 未使用の疑いだけで削除しない。動的参照、設定、外部アプリからの利用を確認する。
- 既存仕様を推測で変更しない。不明点は「未確認」として残す。
- 修正は小さく分割し、可能な範囲でビルド・テスト・静的解析を実行する。
- 破壊的変更、依存パッケージの大規模更新、データ形式変更は事前に影響を確認する。
- 作業の区切りごとに、このファイルの「進捗」と「発見事項」を更新する。
- main には直接 push しない。作業ブランチ `maintenance/review-and-stabilization` を使用する。
- レビュー結果は重要度（Critical / High / Medium / Low）と確度を付けて記録する。

## 作業計画
1. リポジトリ構成・履歴・実行環境・依存関係の調査
2. ビルド／テストの再現性確認と現状ベースライン作成
3. ディレクトリ・機能単位のコードレビュー
4. 未使用コード・依存パッケージの利用状況調査
5. 問題の優先順位付けと小規模修正
6. 検証・残課題・保守手順の整理

## 進捗
- [x] リポジトリの存在、公開状態、既定ブランチを確認
- [x] ルート構成と主要ソース構成を取得
- [x] 保守作業ブランチを作成
- [ ] ビルド・テストのベースライン確認
- [ ] 機能別レビュー
- [ ] 未使用コード・依存関係レビュー
- [ ] 修正・検証

## 初期確認事項
- 既定ブランチ: `main`
- 作業開始時の main SHA: `b0285ec10b4945f62b811703d6dc63260010d225`
- 作業ブランチ: `maintenance/review-and-stabilization`
- ルートに既存の AGENTS.md は存在しなかった。
- コード検索インデックス経由の検索結果は得られなかったため、Git Trees API と個別ファイル取得を使って調査を継続する。

## 発見事項
（調査結果を根拠・対象ファイルとともに追記する）

## 初期レビュー記録（静的確認・未検証）
- `src/Modules/tasks/OmikujiProcess.ts`: `convertInputParams` が `if (inputParams[param.id])` で値の有無を判定している。明示値 `false` / `0` / 空文字が変換対象から除外され、保存値・デフォルト値へフォールバックする可能性がある。スクリプト引数の仕様と照合して優先調査。
- 同ファイル: `process()` が `postFinalMessages()` を await せず、`executeScript()` 内の `PostMessage.post()` も await していない。投稿失敗・完了順序・呼び出し元へのエラー伝播を調査。
- `src/Modules/tasks/OmikujiSelector.ts`: タイマー初期化に `if (0 && immediateResult)` がある。初回即時実行を無効化する意図か、残存コードかを仕様・履歴と照合する。現時点で削除しない。
- `src/Modules/core/InitDataLoader.ts`: JSON読込失敗時に `null` を返す一方、呼び出し側は `Record<string, T>` として扱う。壊れたJSON／ファイル欠損時の起動継続と利用側の安全性を確認。
- 上記はソース上の懸念であり、実行再現・仕様確認前の確定バグとは扱わない。


## ベースライン調査（2026-11-13）
- package.json の test:plugin は jest test/plugin.test.ts を指定しているが、実際のテストファイルは src/test/plugin.test.ts にある。指定パスの不一致により、現状のテストコマンドは対象テストを発見できない可能性が高い（確度: 高）。実行環境での再現は未確認。
- vite.config.ts は src/plugin.ts を CommonJS形式・dist/plugin.js に出力する設定で、package.json の build と整合している。
- src/Modules/tasks/OmikujiSelector.ts の setupTimers は初回 setTimeout のハンドルを保持していない。clearAllTimers は setInterval のみ解除するため、初回待機中に destroy() が呼ばれても、後からintervalが開始されコールバックが実行される可能性がある（確度: 高）。停止処理の不具合として優先確認する。
- src/Modules/tasks/OmikujiSelectorTimer.ts は import と空のクラス定義のみで、実装は OmikujiSelector.ts 内にある。現状このファイルを参照しているか未確認。未使用と断定せず、import/ビルド解決を確認する。
- readJsonFile はファイル欠損・JSON parse失敗時に null を返す。loadDirectoryContents は戻り値を検査せず Record<string, T> に格納する。データ欠損時に後続処理で例外になる可能性がある（確度: 中）。
- Git Trees API上のソースファイル数は41。Actions workflow定義は見当たらず、GitHub Actionsによる自動検証は未確認。

## 進捗更新
- [x] package scripts・主要ビルド設定・テスト配置の静的照合
- [ ] ローカル実行環境でのビルド／テスト実行（GitHub上のファイル参照のみでは実行結果を確認できない）


## 修正（2026-11-13）
- `src/Modules/tasks/OmikujiSelector.ts`: 初回待機用 setTimeout のハンドルを保持し、clearAllTimers/destroy で clearTimeout するよう修正。待機中にプラグインが終了した後、タイマーが再起動する問題を防ぐ。
- `src/test/OmikujiSelectorTimer.test.ts`: 初回interval開始前に destroy した場合、コールバックが実行されずタイマーが残らないことを確認するテストを追加。
- `package.json`: test:plugin の対象を実際の配置 src/test に合わせて修正。
- いずれも GitHub 上でソースを更新した段階。ローカルでの Jest 実行・ビルド検証は未実施。

## 進捗更新
- [x] 初回待機中のタイマー破棄処理を修正
- [x] タイマー破棄テストを追加
- [x] Jest実行対象パスを修正
- [ ] Jest・ビルド実行による検証


## 追加修正・レビュー（2026-11-13）
- `src/Modules/tasks/OmikujiProcess.ts`: スクリプト引数の存在判定をtruthy判定からown-property判定へ変更。明示値 `false` / `0` / 空文字を有効な入力として変換対象に含める。回帰テストを追加。
- 同ファイル: スクリプト投稿と通常投稿は非同期のまま維持しつつ、rejectをcatchしてsystemMessageへ通知するよう変更。コメント処理を投稿遅延でブロックしない既存動作は維持する。
- `src/Modules/api/PostMessage.ts`: 投稿アクション内部で送信Promiseをawaitするよう変更。これによりPostMessage.post()のPromiseが実際の送信失敗を捕捉できる。キャラクター辞書未指定時も例外にならないようoptional chainingを追加。
- `src/test/OmikujiProcessor.test.ts`: false / 0 / 空文字が保持されることを確認するテストを追加。
- Jest・ビルドは未実行。テスト追加・コード変更の実行時検証は残る。

## 追加の未解決レビュー事項
- `PostMessage.post()` は `Promise.all` で投稿を並行実行する一方、コメントには「順次処理を保証」とある。delaySecondsを使った同時投稿制御の意図を確認する必要があり、現時点では変更しない。


## 未使用ファイルの確認・整理（2026-11-13）
- src配下のTypeScript/JavaScriptファイル32件のimport関係を静的に確認。`OmikujiSelectorComment.ts` と `OmikujiSelectorTimer.ts` は他ファイルから参照されず、どちらもimport文だけでクラス等の実装・exportがない空の残骸だった。実際のセレクター実装は `OmikujiSelector.ts` に存在するため、作業ブランチから2ファイルを削除。
- Scripts配下は InitDataLoader がディレクトリから動的requireするため、静的importがないことを理由に未使用とは判定しない。
- そのほかの未使用候補は引き続き動的参照・外部利用を確認してから判断する。

## 進捗更新
- [x] src配下のimport関係を静的確認
- [x] 実装のない未参照selector stub 2件を削除
- [ ] 実機・ローカルでの動作確認


## タイマー実行エラーの処理（2026-11-13）
- `src/Modules/core/InitDataLoader.ts`: timer callback内でOmikujiProcessor.process()のrejectをcatchし、systemMessageで通知するよう修正。タイマー起動経由では呼び出し元がPromiseを待たないため、未処理rejectionになる経路を抑止する。
- この修正もローカル実行検証は未実施。


## データ読み込み・投稿処理レビュー（2026-11-13）
- `src/Modules/core/InitDataLoader.ts`: JSONファイルの読み込み失敗時に `null` をデータ辞書へ格納していた問題を修正。nullデータは登録せずスキップし、既存のエラーログを残す。破損したプリセット等がnullとして後続処理へ流れることを防ぐ。
- `src/Modules/api/PostMessage.ts`: `Promise.all` で投稿を並行開始しているが、コメントは「順次処理を保証」と記載。`delaySeconds` は共通の起点から個別に待つ実装のため、単純なfor-awaitへの変更は遅延の意味を変える可能性がある。投稿順序の仕様を確定できないため変更保留。
- `readJsonFile` はJSON構文エラー・ファイル欠損時もnullを返し、呼び出し側でスキップする。ログを確認して個別ファイルを修復できる運用を想定。起動時の必須データと任意データの区別は未確認。

- Jest設定（jest.config.js / ts-jest）と依存関係は存在することを確認。package.jsonのtest:pluginはWindows向け `set NODE_ENV=development&& jest src/test` に修正済み。GitHub上の静的確認ではテスト検出対象がsrc/testとなることを確認したが、実行結果は未確認。


## 初期化・終了処理の追加確認（2026-11-13）
- `src/plugin.ts`の`destroy()`から`timerSelector.destroy()`が呼ばれ、参照も`undefined`に戻されることを確認。`OmikujiSelectorTimer.destroy()`は初回timeoutとintervalの両方を解除するため、現行タイマーの終了経路は接続されている。
- `startReadyCheck()`はサービス取得成功まで無期限に待機する。サービスが起動しない／APIが恒久的に利用できない場合に`init()`が完了しない可能性があるが、待機仕様（わんコメ起動待ち）との兼ね合いがあるため現時点では変更しない。タイムアウト値や再試行終了条件は未確認。
- `src/test/OmikujiSelectorTimer.test.ts`を確認。destroy前の初回timeout解除を検証するテストが存在する。Jestは未実行。


## 投稿処理の順序・遅延仕様の確認（2026-11-13）
- `src/Modules/api/PostMessage.ts`: `posts`はdelaySeconds順にソートされた配列を受け取り、各postの処理を`Promise.all`で同時に開始する。各投稿APIは呼び出し時点から`delaySeconds + basicDelaySeconds`だけ個別にsetTimeout待機する。
- そのため実際の挙動は「順次処理」ではなく、各投稿のdelaySecondsを共通の開始時刻から数える並行スケジュール。単純なfor-awaitへ変更するとdelaySecondsが累積し、投稿タイミングを変えてしまう可能性がある。
- コードコメント「順次処理を保証」は実装と不一致。現時点ではdelaySecondsの共通起点スケジュールが意図された仕様か未確認のため、実装は変更しない。コメント修正も仕様確認後に行う。
- `OmikujiSelector.ts`: `setupTimers`は0〜60分のうち1〜60分のみ受け付ける。schema側timerConfig.minutesはnonnegativeで0を許可するが、0分設定はselectorでスキップされる。UI入力制約と一致するか未確認。
- `InitDataLoader.ts`: `readJsonFile`はJSON parse失敗時にエラー通知後nullを返し、呼び出し元はそのファイルを読み込み結果から除外する。プリセット等の個別ファイルをスキップする意図か、全体ロードを失敗させるべきかは未確認。

- 追記: `PostMessage.ts`のコメントが実際の並行スケジュールと矛盾していたため、「開始時刻基準のdelaySecondsで並行スケジュールし、完了を待つ」へ修正。処理順・遅延値の挙動自体は変更していない。
