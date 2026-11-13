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

- `src/Modules/components/ThresholdCheck.ts`: match条件のtargetMapはstatus以外を参照する場合も`this.visit.status`を先に評価していた。visitはコンストラクター上optionalのため、未指定時にstatus参照で例外となる可能性がある。optional chainingへ変更し、visit未設定時はstatusを空値として扱う。通常のコメント処理ではvisitが渡されるため通常経路の挙動は不変。確度: 高（静的確認）。

## OneSDK依存関係の更新（2026-11-13）
- `@onecomme.com/onesdk` を `^5.2.3` から `9.2.0-beta.1` へ更新。ユーザー報告により、旧バージョンでは現行環境で動作せず、9.2.0-beta.1が必要。
- プレリリース版を意図せず別バージョンへ解決しないよう、package.jsonは完全固定（caretなし）。
- package-lock.jsonのroot dependencyとSDK package entryも9.2.0-beta.1へ更新。既存lockfileに含まれるaxios / hacktimer依存関係は維持。新バージョンのintegrity値を取得できなかったため、SDK entryのintegrityは削除している。次回npm install時にlockfileが再生成・補完されることを確認する。
- npm.ioの公開情報では、9.2.0-beta.1はOneComme 9.0.0向けAlpha版で、ライセンス表記はOneComme-Use-Only-1.0。OneComme用プラグインとしての利用範囲は目的に合うと考えられるが、配布物にSDKを同梱する場合はライセンス条件を確認する。
- OneComme 9.0.0ではSDKの内部型定義の公開停止、プラグインログの分離などが告知されている。現行コードの型importパスは公式の現行型リファレンスに掲載されているが、9.2.0-beta.1のnpmパッケージ実体との完全一致は未確認。
- ビルド・テストは実施しない方針。SDK APIとの静的な整合性確認を継続する。

## OneSDK 9.2.0-beta.1 互換性の静的確認（2026-11-13）
- ユーザー側でpackage-lock.jsonの補完を実施済み。package.json / package-lock.jsonともに9.2.0-beta.1を指定していることを確認。
- 現行コードが参照するSDK型は `types/Plugin`（OnePlugin / PluginResponse / PluginRequest）、`types/Comment`（Comment / Colors）、`types/UserData`（UserNameData）、`types/Service`（Service）、`types/BaseResponse`（BaseResponse）。OneComme公式の現行SDK型リファレンスにはPlugin / Comment / UserData / Service / BaseResponseの各型群が掲載されており、参照パスの大きな移動は確認できない。9.2.0-beta.1のnpmパッケージ実体と完全一致するかは未確認。
- OneComme 9.0.0の変更告知には内部専用型の非公開化、コメント検索・取得APIの非公開化、プラグインログの分離がある。OmikenPluginではこれらの非公開APIを直接利用している根拠は見つかっていない。現状はHTTP APIの `/services`、`/comments`、`/comments/test`、`/reactions`、`/speech` を利用している。
- 9.2.0-beta.1の変更内容は主にOBS 33 / Chromium 142のローカルファイルテンプレート向け接続後リダイレクト。プラグイン側の直接的な変更点は告知上確認できない。
- 公式資料: OneComme 9.0.0 patch notes、OneSDK型リファレンス、Plugin APIドキュメント。型参照は公開資料上の確認であり、ビルド確認は行わない。

## システム通知送信の失敗処理（2026-11-13）
- `src/Modules/core/ErrorHandler.ts`: `postSystemMessage()` がHTTPエラー等でrejectした際、呼び出し側でcatchされず未処理Promise rejectionになる経路を修正。送信失敗はconsole.errorへ記録し、元の通知処理へ再帰しない。
- `systemMessage()`自体は同期関数のまま維持。通知送信の失敗で本来のエラー処理を中断しない。


## 追加レビュー・修正（2026-11-13）
- `src/Modules/api/serviceAPI.ts`: 枠作成時のカラーコード検証が文字数のみだったため、6桁の16進数以外（例: `GG0000`）でもparseIntがNaNを返し、そのままRGB値に入る経路があった。正規表現で6桁の16進数を検証するよう修正。
- `#RRGGBB` と `RRGGBB` の両形式は従来どおり受け付ける。大文字小文字も許可。実行時検証は未実施。


## 外部バックアップAPIの追加レビュー（2026-11-13）
- `src/Modules/api/ApiRequest.ts`: `Mode.Backup` のPOSTで受け取った `body.data` を、スキーマ検証せず `store.set('Omiken', newOmiken)` へ保存している。外部クライアントから不正・欠損データが渡された場合、永続化後のプラグイン処理や次回起動に影響する可能性がある（重要度: Medium、確度: 高・静的確認）。
- APIの利用クライアント、バックアップ形式の互換性、共有可能な検証スキーマの有無は未確認。データ形式の破壊や既存バックアップとの互換性を避けるため、現時点では入力検証を追加せず保留。
- `RequestHandler.request()` はPOST処理をPromiseとして返す。バックアップ処理内部には例外捕捉があるが、`handlePost` 冒頭の同期例外はasync関数のrejectになるため、外側のtry/catchだけでは捕捉できない構造。現在の冒頭処理は単純なmode比較のため、直ちに問題となる例外は確認できない。


## バックアップAPI・依存バージョンの追加確認（2026-11-13）
- `src/Modules/api/ApiRequest.ts`: バックアップPOSTで、永続化（`store.set`）後に `filterTypes` を実行していた。受信データの `types` / `rules` が欠損して派生データ生成に失敗すると、APIは失敗応答でも永続データだけが更新される不整合が起きるため、先に `OmikenTypesArray` を生成し、成功後に永続化する順序へ変更。
- これは完全なスキーマ検証ではない。データ構造・互換性を確認できる共通スキーマが見つかっていないため、任意入力の完全検証は引き続き未対応。API利用側とバックアップ仕様を確認してから別途判断。
- `package.json` を再確認したところ、OneSDK指定が `^9.2.0-beta.1` に戻っており、`package-lock.json` のルート指定は `9.2.0-beta.1` 固定だった。再現性を揃えるため `package.json` も固定指定に戻した。ロックファイルの解決バージョンは `9.2.0-beta.1`。

- 変更後の静的確認: `updateOmikenData` は派生データ生成を永続化より先に実行する。これにより `filterTypes` 失敗時に永続データだけが先行更新される不整合を防止する。外部入力の完全な構造検証は未実施。
- OneSDK lockfile確認: `package-lock.json` のルート依存とインストール対象は `9.2.0-beta.1`。ただし取得した `node_modules/@onecomme.com/onesdk` エントリーには `integrity` フィールドが見当たらない。ハッシュ値は推測で追加しない。ユーザー側で補完した内容がこのブランチへ反映済みかは未確認。
