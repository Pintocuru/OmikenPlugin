// src/Modules/subscribeMeta/subscribeMeta.ts
import { PluginUpdateData, PluginMainType, VisitType } from '@type'
import { OmikujiSelector } from '@tasks/OmikujiSelector'
import { OmikujiProcessor } from '@tasks/OmikujiProcess'
import { UserNameData } from '@onecomme.com/onesdk/types/UserData'
import { Comment } from '@onecomme.com/onesdk/types/Comment'

export class CommentBotProcessor {
  private visit: VisitType
  private isFirstVisit: boolean
  private isTester: boolean

  // 初期化
  constructor(
    private storeAll: PluginMainType,
    private comment: Comment,
    private userData: UserNameData
  ) {
    this.initializeVisit()
    this.storeAll.Visits[comment.data.userId] = this.visit
    this.processComment()
  }

  // ユーザーの枠情報が空白または異なるなら、Visitを初期化
  private initializeVisit(): void {
    const currentVisit = this.storeAll.Visits[this.comment.data.userId] || ({} as VisitType)
    const pluginTime = this.storeAll.TimeConfig.pluginTime

    this.visit = {
      name: this.comment.data.name,
      userId: this.comment.data.userId,
      round: currentVisit.round || 0,
      status: currentVisit.status || '',
      point: currentVisit.point || 0,
      lastPluginTime: currentVisit.lastPluginTime || 0,
    }

    // 1回目のコメントかどうか
    this.isFirstVisit = this.visit.lastPluginTime !== pluginTime

    // visitの初期化
    if (this.isFirstVisit) {
      this.visit.round++
      this.visit.lastPluginTime = pluginTime
      this.visit.status = ''
    }
  }

  // コメントの前処理
  private processComment(): void {
    this.isTester = this.comment.id === 'COMMENT_TESTER'

    // 擬似メタデータ
    // メタデータはプラグインの解決後に生成される仕様です
    this.comment.meta = this.isTester
      ? { interval: 999999, tc: 10, no: 2, lc: 2 }
      : {
          interval: this.userData?.interval || 0,
          tc: this.userData?.tc + 1 || 1, // カウント前なのでインクリメント
          lc: this.storeAll.TimeConfig?.lc || 1, // プラグインが起動してからカウントしたコメント数
          no: this.visit.round || 1, // (仕様とは異なる)round:コメントした枠数
          free: !!this.isFirstVisit, // (仕様とは異なる)初回かどうか
        }
  }

  // ユーザー情報の永続化
  returnVisit(): VisitType {
    this.storeAll.store.set(`Visits.${this.comment.data.userId}`, this.visit)
    return this.visit
  }

  // おみくじの処理
  async process(): Promise<PluginUpdateData> {
    // コメントモードでの使用
    const selector = OmikujiSelector.create('comment', {
      comment: this.comment,
      visit: this.visit,
      timeConfig: this.storeAll.TimeConfig,
    })

    // commentのrules からおみくじを抽選
    const omikujiSelect = selector.selectOmikuji(
      this.storeAll.OmikenTypesArray.comment,
      this.storeAll.Omiken.omikujis,
      this.storeAll.Games
    )

    // おみくじがない場合はvisitだけ返す
    if (!omikujiSelect) {
      return {
        Visits: this.storeAll.Visits,
        Games: this.storeAll.Games,
        TimeConfig: this.storeAll.TimeConfig,
      }
    }

    // Omikujiの処理
    return new OmikujiProcessor(this.storeAll, omikujiSelect, this.comment).process()
  }
}
