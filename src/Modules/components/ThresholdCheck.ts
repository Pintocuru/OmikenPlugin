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
 VisitType
} from '@type';
import { Comment } from '@onecomme.com/onesdk/types/Comment';

// 条件
export class ThresholdChecker {
 constructor(
  private readonly rule: RulesType,
  private readonly TimeConfig: TimeConfigType,
  private readonly comment?: Comment | undefined,
  private readonly visit?: VisitType | undefined,
  private readonly Games?: Record<string, GameType> | undefined
 ) {}

 // 条件チェック（配列全体）
 checkAll(thresholds: ThresholdType[]): boolean {
  return thresholds.every((threshold) => this.check(threshold));
 }

 // 条件チェック(単独)
 check(threshold: ThresholdType): boolean {
  const conditionMap = {
   target: () => this.matchIsTarget(),
   coolDown: () => this.matchIsCoolDown(threshold.coolDown),
   syoken: () => this.matchIsSyoken(threshold.syoken),
   access: () => this.matchIsAccess(threshold.access),
   gift: () => this.matchIsGift(threshold.gift),
   count: () => this.matchIsCount(threshold.count),
   match: () => this.matchIsMatch(threshold.match)
  } as const;

  return conditionMap[threshold.conditionType]?.() ?? false;
 }

 // 前回のコメントと今回のコメントが同一人物なら適用
 private matchIsTarget(): boolean {
  return this.comment?.data.userId === this.TimeConfig.lastUserId || false;
 }

 // クールダウンのチェック
 private matchIsCoolDown(coolDown: number): boolean {
  return Date.now() < this.TimeConfig.lastTime + coolDown * 1000;
 }

 // 初見・久しぶりのチェック
 private matchIsSyoken(syoken: SyokenCondition): boolean {
  // (仕様書とは異なる)meta.free は配信枠1コメめかどうか
  if (!this.comment?.meta.free) return false;

  const conditions: Record<SyokenCondition, () => boolean> = {
   [SyokenCondition.SYOKEN]: () => this.comment.meta?.interval === 0 || this.comment.meta?.interval === undefined,
   [SyokenCondition.AGAIN]: () => this.comment.meta.interval > 7 * 24 * 60 * 60 * 1000,
   [SyokenCondition.HI]: () => !conditions[SyokenCondition.SYOKEN]() && !conditions[SyokenCondition.AGAIN](),
   [SyokenCondition.ALL]: () => true
  };
  return conditions[syoken]?.() ?? false;
 }

 // ユーザーの役職
 private matchIsAccess(access: AccessCondition): boolean {
  if (access === 1) return true;
  if (!this.comment?.data) return false;

  const { isOwner, isModerator, isMember } = this.comment.data as {
   isOwner: boolean;
   isModerator?: boolean;
   isMember?: boolean;
  };

  return (access <= 4 && isOwner) || (access <= 3 && isModerator) || (access <= 2 && isMember) || false;
 }

 // ギフトを参照する
 private matchIsGift(gift: GiftCondition): boolean {
  if (!this.comment?.data) return false;

  // Noneの場合、ギフトがあればfalse
  const { hasGift } = this.comment.data;
  if (gift === GiftCondition.None) return !hasGift;
  // ギフトがない場合、false
  if (!hasGift) return false;

  const price = 'price' in this.comment.data ? this.comment.data.price : null;
  const tier = 'tier' in this.comment.data ? this.comment.data.tier : null;

  // 指定したTier以上のギフトがあるならtrue
  const calTier = tier ?? this.matchIsGiftHelper(price);
  return calTier >= gift;
 }

 private matchIsGiftHelper(price: number | null): GiftCondition {
  if (!price || price <= 0) return GiftCondition.All;
  const giftRanges = new Map([
   [200, GiftCondition.Blue],
   [500, GiftCondition.LightBlue],
   [1000, GiftCondition.Green],
   [2000, GiftCondition.Yellow],
   [5000, GiftCondition.Orange],
   [10000, GiftCondition.Pink],
   [20000, GiftCondition.Red],
   [Infinity, GiftCondition.Purple]
  ]);
  for (const [threshold, condition] of giftRanges) {
   if (price < threshold) return condition;
  }
  return GiftCondition.Purple;
 }

 // 数値を参照する
 private matchIsCount(count: CountCondition): boolean {
  if (!this.comment && (count.unit === 'tc' || count.unit === 'interval')) return false;

  const userStats = this.Games?.[this.rule?.id]?.userStats[this.comment?.data.userId];
  const gameData = this.Games?.[this.rule?.id];
  const meta = this.comment?.meta;

  // drawsはインクリメント前なので+1しておく
  const unitMap: Record<CountCondition['unit'], number> = {
   draws: userStats?.draws + 1 || 0,
   totalDraws: userStats?.totalDraws + 1 || 0,
   gameDraws: gameData?.draws + 1 || 0,
   gameTotalDraws: gameData?.totalDraws + 1 || 0,
   lc: meta?.lc || 0,
   tc: meta?.tc || 0,
   interval: Math.floor((meta?.interval || 0) / 1000)
  };

  return this.matchIsCountHelper(unitMap[count.unit], count);
 }

 // 数値比較ヘルパー関数
 private matchIsCountHelper(value: number, count: CountCondition): boolean {
  const { comparison, value1, value2 } = count;

  const comparisonStrategies = {
   range: () => value2 !== undefined && value >= Math.min(value1, value2) && value <= Math.max(value1, value2),
   loop: () => value1 !== 0 && value % value1 === 0,
   min: () => value <= value1,
   max: () => value >= value1,
   equal: () => value === value1
  } as const;

  return comparisonStrategies[comparison]?.() ?? false;
 }

 // 文字列を参照する
 private matchIsMatch(match: MatchCondition): boolean {
  if (!this.comment) return false;

  const targetMap = {
   status: this.visit?.status,
   comment: this.comment?.data?.comment,
   name: this.comment?.data?.name,
   displayName: this.comment?.data?.displayName
  };

  const text = targetMap[match.target] || '';

  return match.value.some((word) => {
   const isEmoji = /\p{Emoji}/u.test(word);
   const [normalizedWord, normalizedText] = isEmoji ? [word, text] : [word.toLowerCase(), text.toLowerCase()];

   const matchMethods = {
    exact: () => normalizedWord === normalizedText,
    starts: () => normalizedText.startsWith(normalizedWord),
    include: () => normalizedText.includes(normalizedWord)
   };
   return matchMethods[match.case]();
  });
 }
}
