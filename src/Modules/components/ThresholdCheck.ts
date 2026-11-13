// src/Modules/components/ThresholdCheck.ts

import {
  AccessCondition,
  CountCondition,
  GameType,
  GiftCondition,
  MatchCondition,
  RulesType,
  SyokenCondition,
  ThresholdType,
  TimeConfigType,
  VisitType,
} from '@type'
import { Comment } from '@onecomme.com/onesdk/types/Comment'

// 条件
export class ThresholdChecker {
  readonly game: GameType
  constructor(
    private readonly rule: RulesType,
    private readonly TimeConfig: TimeConfigType,
    private readonly comment?: Comment | undefined,
    private readonly visit?: VisitType | undefined,
    Games?: Record<string, GameType> | undefined
  ) {
    this.game = Games?.[rule.id]
  }

  // 条件チェック（配列全体）
  checkAll(thresholds: ThresholdType[]): boolean {
    return thresholds.reduce((accumulator, threshold, index, array) => {
      const result = this.check(threshold)
      const nextThreshold = array[index + 1]

      if (nextThreshold && threshold.isAnd === true) {
        return accumulator && result // AND 条件
      } else {
        return accumulator || result // OR 条件 (最後の要素は OR 条件とみなす)
      }
    }, true) // 初期値は true (空の配列の場合に true を返すため)
  }

  // 条件チェック(単独)
  check(threshold: ThresholdType): boolean {
    const conditionMap = {
      target: () => this.matchIsTarget(threshold.target),
      coolDown: () => this.matchIsCoolDown(threshold.coolDown),
      syoken: () => this.matchIsSyoken(threshold.syoken),
      access: () => this.matchIsAccess(threshold.access),
      gift: () => this.matchIsGift(threshold.gift),
      count: () => this.matchIsCount(threshold.count),
      match: () => this.matchIsMatch(threshold.match),
    } as const

    const result = conditionMap[threshold.conditionType]?.() ?? false
    return threshold.isNot === true ? !result : result // isNot を適用
  }

  // 連続投稿が数値以上なら適用
  private matchIsTarget(target: number = 2): boolean {
    const { currentUserIds } = this.game
    if (!currentUserIds?.length) return false

    const targetUser = currentUserIds[0]
    const consecutiveCount = currentUserIds.findIndex((id) => id !== targetUser)

    return (consecutiveCount === -1 ? currentUserIds.length : consecutiveCount) >= target
  }

  // クールダウンのチェック
  private matchIsCoolDown(coolDown: number = 3): boolean {
    return Date.now() < this.TimeConfig.lastTime + coolDown * 1000
  }

  // 初見・久しぶりのチェック
  private matchIsSyoken(syoken: SyokenCondition = SyokenCondition.SYOKEN): boolean {
    // (仕様書とは異なる)meta.free は配信枠1コメめかどうか
    if (!this.comment?.meta.free) return false

    const conditions: Record<SyokenCondition, () => boolean> = {
      [SyokenCondition.SYOKEN]: () => this.comment.meta?.interval === 0 || this.comment.meta?.interval === undefined,
      [SyokenCondition.AGAIN]: () => this.comment.meta.interval > 7 * 24 * 60 * 60 * 1000,
      [SyokenCondition.HI]: () => !conditions[SyokenCondition.SYOKEN]() && !conditions[SyokenCondition.AGAIN](),
      [SyokenCondition.ALL]: () => true,
    }
    return conditions[syoken]?.() ?? false
  }

  // ユーザーの役職
  private matchIsAccess(access: AccessCondition = 2): boolean {
    if (!this.comment?.data) return false

    const { isOwner, isModerator, isMember } = this.comment.data as {
      isOwner: boolean
      isModerator?: boolean
      isMember?: boolean
    }

    return (access <= 4 && isOwner) || (access <= 3 && isModerator) || (access <= 2 && isMember) || false
  }

  // ギフトを参照する
  private matchIsGift(gift: GiftCondition = 0): boolean {
    if (!this.comment?.data) return false

    const { hasGift } = this.comment.data
    // ギフトがない場合、false
    if (!hasGift) return false

    const price = 'price' in this.comment.data ? this.comment.data.price : null
    const tier = 'tier' in this.comment.data ? this.comment.data.tier : null

    // 指定したTier以上のギフトがあるならtrue
    const calTier = tier ?? this.matchIsGiftHelper(price)
    return calTier >= gift
  }

  private matchIsGiftHelper(price: number | null): GiftCondition {
    if (!price || price <= 0) return GiftCondition.All
    const giftRanges = new Map([
      [200, GiftCondition.Blue],
      [500, GiftCondition.LightBlue],
      [1000, GiftCondition.Green],
      [2000, GiftCondition.Yellow],
      [5000, GiftCondition.Orange],
      [10000, GiftCondition.Pink],
      [20000, GiftCondition.Red],
      [Infinity, GiftCondition.Purple],
    ])
    for (const [threshold, condition] of giftRanges) {
      if (price < threshold) return condition
    }
    return GiftCondition.Purple
  }

  // 数値を参照する
  private matchIsCount(count: CountCondition = { comparison: 'max', unit: 'draws', value1: 1, value2: 1 }): boolean {
    if (!this.comment && (count.unit === 'tc' || count.unit === 'intvlSec')) return false

    const { lc = 0, tc = 0, interval = 0 } = this.comment?.meta

    // drawsはインクリメント前なので+1しておく
    const unitMap: Record<CountCondition['unit'], number> = {
      draws: this.game?.userStats[this.comment?.data.userId]?.draws + 1 || 0,
      gameDraws: this.game?.draws + 1 || 0,
      lc,
      tc,
      intvlSec: Math.floor(interval / 1000),
    }

    return this.matchIsCountHelper(unitMap[count.unit], count)
  }

  // 数値比較ヘルパー関数
  private matchIsCountHelper(value: number, count: CountCondition): boolean {
    const { comparison, value1, value2 } = count

    const comparisonStrategies = {
      range: () => value2 !== undefined && value >= Math.min(value1, value2) && value <= Math.max(value1, value2),
      loop: () => value1 !== 0 && value % value1 === 0,
      min: () => value <= value1,
      max: () => value >= value1,
      equal: () => value === value1,
    } as const

    return comparisonStrategies[comparison]?.() ?? false
  }

  // 文字列を参照する
  private matchIsMatch(match: MatchCondition): boolean {
    if (!this.comment) return false

    const targetMap = {
      status: this.visit?.status,
      comment: this.comment?.data?.comment,
      name: this.comment?.data?.name,
      displayName: this.comment?.data?.displayName,
    }

    const text = targetMap[match.target] || ''

    return match.value.some((word) => {
      const isEmoji = /\p{Emoji}/u.test(word)
      const [normalizedWord, normalizedText] = isEmoji ? [word, text] : [word.toLowerCase(), text.toLowerCase()]

      const matchMethods = {
        exact: () => normalizedWord === normalizedText,
        starts: () => normalizedText.startsWith(normalizedWord),
        include: () => normalizedText.includes(normalizedWord),
      }
      return matchMethods[match.case]()
    })
  }
}
