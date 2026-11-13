// src/plugin.ts
// プラグインの型定義 : https://types.onecomme.com/interfaces/types_Plugin.OnePlugin
import { PluginStoreType, PluginAllType, PluginApiType, VisitType } from '@type'
import { InitDataLoader, startReadyCheck, timerSetup } from '@core/InitDataLoader'
import { commentParamsPlus, commentTreatment } from '@core/commentTreatment'
import { systemMessage } from '@core/ErrorHandler'
import { RequestHandler } from '@api/ApiRequest'
import { CommentBotProcessor } from '@tasks/CommentBotProcessor'
import { SETTINGS } from '@/Modules/settings'
import ElectronStore from 'electron-store'
import { Comment } from '@onecomme.com/onesdk/types/Comment'
import { UserNameData } from '@onecomme.com/onesdk/types/UserData'
import { OnePlugin, PluginResponse } from '@onecomme.com/onesdk/types/Plugin'
import { defaultState } from './Modules/defaultState'
import { SendType } from '@onecomme.com/onesdk/types/Api'

const plugin: OnePlugin = {
  name: 'おみくじBOTプラグイン', // プラグイン名
  uid: SETTINGS.PLUGIN_UID, // プラグイン固有の一意のID
  version: '0.3.0-beta01', // プラグインのバージョン番号
  author: 'Pintocuru', // 開発者名
  url: 'https://pintocuru.booth.pm/items/6499304', // サポートページのURL
  // services:枠情報,filter.comment:コメント
  permissions: ['services', 'filter.comment', 'meta'],

  // プラグインの初期状態
  defaultState: defaultState,
  // プラグインの初期化
  async init(this: PluginAllType, { store }: { store: ElectronStore<PluginStoreType> }) {
    try {
      // わんコメの枠データが取得できる(=セットアップ完了)まで待つ
      await startReadyCheck()

      // 初期化
      Object.assign(this, new InitDataLoader(store).load())
      // timerのセットアップ
      await timerSetup(this)

      // プラグインの起動メッセージ
      systemMessage('info', `【おみくじBOTプラグイン】が起動したよ`)
    } catch (e) {
      systemMessage('error', `【おみくじBOTプラグイン】の初期化に失敗`, e)
      throw new Error()
    }
  },

  // filterComment:コメントを加工・変更する
  async filterComment(this: PluginAllType, comment, service, userData) {
    // 自身のプラグインの投稿（botの投稿）はおみくじを行わない
    if (comment.data.userId === SETTINGS.BOT_USER_ID) {
      return commentTreatment(comment)
    }
    // おみくじBOT処理
    if (userData) await this.filterCommentProcess(comment, userData)

    // パラメータを付与してreturn
    return commentParamsPlus(comment, this.Visits[comment.data.userId])
  },

  // filterCommentProcess:おみくじBOT処理
  async filterCommentProcess(this: PluginAllType, comment: Comment, userData: UserNameData) {
    try {
      const COMMENT_EXPIRY_MS = 5000 // 5秒以上経過したコメントはおみくじの対象外
      this.TimeConfig.lc++ // TimeConfig.lcをインクリメント

      // インスタンスの発行
      const botProcessor = new CommentBotProcessor(this, comment, userData)
      // ユーザー情報の更新
      this.Visits[comment.data.userId] = botProcessor.returnVisit()

      // 期限切れコメントの早期リターン
      const commentAge = Date.now() - new Date(comment.data.timestamp).getTime()
      if (commentAge > COMMENT_EXPIRY_MS) return

      // おみくじの処理
      const result = await botProcessor.process()
      Object.entries(result).forEach(([key, value]) => {
        const storeKey = key as keyof PluginAllType
        if (value && this[storeKey]) this[storeKey] = value
      })
    } catch (e) {
      systemMessage('error', `おみくじBOTの処理ができませんでした`, e)
      return null
    }
  },

  // 終了時の処理
  destroy(this: PluginAllType): void {
    // タイマーが存在する場合のみ破棄
    if (this.timerSelector) {
      this.timerSelector.destroy()
      this.timerSelector = undefined
    }
  },

  subscribe(type: SendType, args: any[]) {
    // 現在はmetaのみ
    if (type === 'meta') {
      // https://types.onecomme.com/interfaces/types_Service.Service
    } else if (type === 'waitingList') {
      // waitingList 参加リスト
      // https://types.onecomme.com/interfaces/types_Order.OrderItem
    } else if (type === 'setList') {
      // setList セットリスト
      // https://types.onecomme.com/interfaces/types_Setlist.SetListAPIResponse
    } else if (type === 'reactions') {
      // reactions
      // https://types.onecomme.com/interfaces/types_Comment.Reaction
    } else {
      systemMessage('info', `${type},${args}`)
      console.info(type, args)
    }
    // pinned / bookmarked の機能もあってもいいかも…
  },

  // Rest APIを使った送受信
  async request(this: PluginAllType, req): Promise<PluginResponse> {
    // データ型のマッピング
    const responseMap: PluginApiType = {
      store: this.store,
      Omiken: this.Omiken,
      Presets: this.Presets,
      Charas: this.Charas,
      Scripts: this.Scripts,
      Visits: this.Visits,
      Games: this.Games,
    }

    const result = await new RequestHandler(responseMap).request(req)
    if (result.data) {
      Object.entries(result.data).forEach(([key, value]) => {
        if (key in this) (this as any)[key] = value
      })
    }
    return result.response
  },
}

module.exports = plugin
