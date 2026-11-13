// src/Modules/tasks/OmikujiSelector.ts
import { GameType, OmikujiSelectType, OmikujiType, RulesType, TimeConfigType, TypesType, VisitType } from '@type';
import { ThresholdChecker } from '@components/ThresholdCheck';
import { PlayOmikuji } from '@components/PlayOmikuji';
import { Comment } from '@onecomme.com/onesdk/types/Comment';

export interface OmikujiSelectorOptions {
 comment: Comment;
 visit: VisitType;
 timeConfig: TimeConfigType;
}

// omikujiをセレクトする
export class OmikujiSelector {
 static create(mode: TypesType, options?: OmikujiSelectorOptions): OmikujiSelectorBase {
  switch (mode) {
   case 'comment':
    return new OmikujiSelectorComment(options);

   case 'timer':
    return new OmikujiSelectorTimer();

   // 今後の開発に期待
   case 'meta':
   case 'waitingList':
   case 'setList':
    throw new Error(`Mode ${mode} is not implemented yet`);

   default:
    throw new Error(`Unsupported mode: ${mode}`);
  }
 }
}

// おみくじ(アイテム抽選)
export abstract class OmikujiSelectorBase {
 abstract selectOmikuji(
  rules: RulesType[],
  omikujis: Record<string, OmikujiType>,
  Games: Record<string, GameType>
 ): OmikujiSelectType | null;

 protected playOmikuji(items: OmikujiType[]): OmikujiType | null {
  if (items.length === 0) return null;

  // rankが最も高い値を取得しフィルタリング
  const maxRank = Math.max(...items.map((item) => item.rank));
  const highestRankItems = items.filter((item) => item.rank === maxRank);

  // weightを計算し抽選
  const totalWeight = highestRankItems.reduce((sum, item) => sum + Math.max(item.weight, 1), 0);
  if (totalWeight <= 0) return null;
  let random = Math.random() * totalWeight;
  return highestRankItems.find((item) => (random -= Math.max(item.weight, 1)) < 0) ?? null;
 }
}

// ---

// comment:
export class OmikujiSelectorComment extends OmikujiSelectorBase {
 constructor(private readonly options: OmikujiSelectorOptions) {
  super();
 }

 // 各ルールに対して処理を実行し、ruleも一緒に返す
 selectOmikuji(
  rules: RulesType[],
  omikujis: Record<string, OmikujiType>,
  Games: Record<string, GameType>
 ): OmikujiSelectType | null {
  return (
   rules
    .map((rule) => {
     const omikuji = this.processRule(rule, omikujis, Games);
     return omikuji ? { ...omikuji, selectRuleId: rule.id } : null;
    })
    .find((result) => result !== null) || null
  );
 }

 private processRule(
  rule: RulesType,
  omikujis: Record<string, OmikujiType>,
  Games: Record<string, GameType>
 ): OmikujiType | null {
  const { timeConfig, comment, visit } = this.options;
  const checker = new ThresholdChecker(rule, timeConfig, comment, visit, Games);

  // ルールが有効でない場合は null を返す
  if (!checker.checkAll(rule.threshold)) return null;

  // 有効なおみくじをフィルタリング
  const validOmikujis = rule.enableIds
   .map((id) => omikujis[id])
   .filter((omikuji) => checker.checkAll(omikuji.threshold));

  if (validOmikujis.length > 0) {
   const play = new PlayOmikuji(validOmikujis);
   return play.draw() as OmikujiType;
  } else return null;
 }
}

// ---

export class OmikujiSelectorTimer extends OmikujiSelectorBase {
 private timers: NodeJS.Timeout[] = [];
 private initialTimers: NodeJS.Timeout[] = [];

 constructor() {
  super();
  this.clearAllTimers();
 }

 // 全ルールに対するおみくじ選択
 selectOmikuji(rules: RulesType[], omikujis: Record<string, OmikujiType>): OmikujiSelectType | null {
  return (
   rules
    .map((rule) => {
     const omikuji = this.selectOmikujiForRule(rule, omikujis);
     return omikuji ? { ...omikuji, selectRuleId: rule.id } : null;
    })
    .find((result) => result !== null) || null
  );
 }

 // 次の実行時刻までの待機時間を計算（ミリ秒）
 private calculateNextInterval(minutes: number, isBaseZero: boolean): number {
  const now = new Date();
  let nextTime: Date;

  if (isBaseZero) {
   const currentMinutes = now.getMinutes();
   const minutesToNext = minutes - (currentMinutes % minutes);
   nextTime = new Date(now);
   nextTime.setMinutes(currentMinutes + minutesToNext);
   nextTime.setSeconds(0);
   nextTime.setMilliseconds(0);
  } else {
   nextTime = new Date(now.getTime() + minutes * 60000);
  }

  const delay = nextTime.getTime() - now.getTime();
  return delay;
 }

 // タイマーを設定して定期実行を開始（複数ルール対応）
 setupTimers(
  rules: RulesType[],
  omikujis: Record<string, OmikujiType>,
  callback: (result: OmikujiSelectType) => void
 ): void {
  // 既存のタイマーをクリア
  this.clearAllTimers();

  rules.forEach((rule) => {
   if (!rule.timerConfig) return;
   const { minutes, isBaseZero } = rule.timerConfig;
   // バリデーション 1分以上60分以下の間でない場合はスキップ
   if (minutes < 1 || minutes > 60) return;

   const immediateResult = this.selectOmikujiForRule(rule, omikujis);
   if (0 && immediateResult) callback(immediateResult);

   const initialDelay = this.calculateNextInterval(minutes, isBaseZero);

   const initialTimer = setTimeout(() => {
    this.initialTimers = this.initialTimers.filter((timer) => timer !== initialTimer);

    const timer = setInterval(() => {
     const result = this.selectOmikujiForRule(rule, omikujis);
     if (result) callback(result);
    }, minutes * 60000);

    this.timers.push(timer);

    const result = this.selectOmikujiForRule(rule, omikujis);
    if (result) callback(result);
   }, initialDelay);
   this.initialTimers.push(initialTimer);
  });
 }

 // 単一ルールに対するおみくじ選択
 private selectOmikujiForRule(rule: RulesType, omikujis: Record<string, OmikujiType>): OmikujiSelectType | null {
  const validOmikujis = rule.enableIds.map((id) => omikujis[id]).filter(Boolean);
  const selectedOmikuji = this.playOmikuji(validOmikujis);
  if (selectedOmikuji) return { ...selectedOmikuji, selectRuleId: rule.id };
  else return null;
 }

 // タイマーをすべてクリア
 private clearAllTimers(): void {
  this.initialTimers.forEach((timer) => clearTimeout(timer));
  this.initialTimers = [];
  this.timers.forEach((timer) => clearInterval(timer));
  this.timers = [];
 }

 destroy(): void {
  this.clearAllTimers();
 }
}
