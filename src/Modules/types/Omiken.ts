// src/types/Omiken.ts
///////////////////////////////////
// Omiken
///////////////////////////////////

// Omiken:おみくじ&初見判定ちゃんBOT用型定義
export interface OmikenType {
  types: Record<TypesType, string[]>
  rules: Record<string, RulesType> // おみくじのルールを管理
  omikujis: Record<string, OmikujiType> // おみくじ関連のメッセージ
  places: Record<string, PlaceType> // プレースホルダー
}

// コンテンツの型マッピング
export type OmikenTypeMap = {
  types: string[]
  rules: RulesType
  omikujis: OmikujiType
  places: PlaceType
}

///////////////////////////////////
// types
///////////////////////////////////

export type TypesType =
  | 'comment' // コメントでの起動
  | 'timer' // タイマー(定期的な起動)
  | 'meta'
  | 'waitingList'
  | 'setList'
  | 'reactions'
  | 'unused' // 無効;

///////////////////////////////////
// rules/omikuji/place 共通
///////////////////////////////////

// 基本となる項目のインターフェース
export interface BaseType {
  id: string // キー名
  name: string // ルール名
  description: string // 説明文
}

///////////////////////////////////
// rules
///////////////////////////////////

// rules:おみくじルールの型定義
export interface RulesType extends BaseType {
  color: string // エディターでの識別用カラー
  enableIds: string[] // このrulesで使用する、omikujiリスト
  threshold: ThresholdType[] //発動条件
  timerConfig?: {
    // タイマー用設定リスト
    minutes: number
    isBaseZero: boolean
  }
}

///////////////////////////////////
// omikuji
///////////////////////////////////

// おみくじメッセージの型定義
export interface OmikujiType extends BaseType {
  rank: number // 優先度
  weight: number // 出現割合
  threshold: ThresholdType[] // 発動条件
  status?: string // ユーザーに対するステータスの付与
  script?: {
    scriptId: string // 使用する外部スクリプトのid
    params: Record<string, string | number | boolean> // 外部スクリプトに渡す引数(Scriptから取得する)
  }
  placeIds: string[] // 使用するプレースホルダーのid
  post: OneCommePostType[]
}

// メッセージの投稿情報を管理する型
export interface OneCommePostType {
  type:
    | 'onecomme' // わんコメへの投稿
    | 'party' // WordPartyの投稿
    | 'speech' // わんコメのスピーチ機能
    | 'error' // わんコメへの投稿(プラグインのエラーメッセージ用)
  botKey?: string // ボットキー
  iconKey?: string // アイコンキー
  party?: string // 発動するWordParty
  isSilent?: boolean // BOTのメッセージを読み上げない
  generatorParam?: string // ジェネレーターに渡す引数
  delaySeconds: number // メッセージを送信するまでの遅延時間
  content: string // メッセージ内容
}

///////////////////////////////////
// Place
///////////////////////////////////
// プレースホルダー項目の型定義
export interface PlaceType extends BaseType {
  placeIds: string[]
  values: PlaceValueType[]
}

export type PlaceValueType = {
  weight: number // 出現割合
  value: string // 値（他のプレースホルダーへの参照可能: <<place_name>>）
}

///////////////////////////////////
// Threshold(rules,omikuji)
///////////////////////////////////

// 共通の条件型
export interface ThresholdType {
  conditionType: ConditionType
  isNot?: boolean // 条件を反転させる
  isAnd?: boolean // 次の条件との関係 (true:AND/false:OR)
  target?: number // 連続投稿がこの数値以上なら適用
  coolDown?: number // おみくじ機能が機能してから指定した時間(秒)が経過していない場合に適用
  syoken?: SyokenCondition // 初見・久しぶり
  access?: AccessCondition // ユーザーの役職
  gift?: GiftCondition // ギフトの有無
  count?: CountCondition // 数値を参照する
  match?: MatchCondition // 文字列を参照する
}

// condition選択用
export type ConditionType = 'target' | 'coolDown' | 'syoken' | 'access' | 'gift' | 'count' | 'match'

// syoken:初見・コメント履歴の種別
export enum SyokenCondition {
  SYOKEN = 1, // 初見
  AGAIN = 2, // 前回のコメントから7日以上経過
  HI = 3, // 上記以外の、その配信枠で1回目のコメント
  ALL = 4, // 上記すべての、その配信枠で1回目のコメント
}

// access:ユーザーの役職 0:OFF/1:だれでも/2:メンバー/3:モデレーター/4:管理者
export enum AccessCondition {
  MEMBER = 2,
  MODERATOR = 3,
  ADMIN = 4,
}

// gift:ギフトのRank
export enum GiftCondition {
  All = 0, // 全て(メンバー加入含む)
  Blue = 1, // 200円未満
  LightBlue = 2, // 200円〜499円
  Green = 3, // 500円〜999円
  Yellow = 4, // 1,000円〜1,999円
  Orange = 5, // 2,000円〜4,999円
  Pink = 6, // 5,000円〜9,999円
  Red = 7, // 10,000円以上
  Purple = 8, // 20,000円以上
}

// count:数値を参照する
export interface CountCondition {
  comparison:
    | 'min' // 数値以下
    | 'max' // 数値以上
    | 'range' // value1以上 value2以下
    | 'equal' // 等しい
    | 'loop' // 数値をvalue1で割った数
  unit:
    | 'draws' // その枠でrulesに該当した回数(個人)
    | 'gameDraws' // その配信枠でrulesに該当した回数(合計)
    | 'lc' // 配信枠のコメント数(プラグインで独自に付与)
    | 'tc' // 総数の個人コメ数(userData.tc)
    | 'intvlSec' // そのユーザーの前回のコメントからの経過時間(秒)(userData.interval*1000)
  value1: number
  value2: number
}

// match:文字列を参照する
export interface MatchCondition {
  target:
    | 'status' // ユーザーごとのstatus
    | 'comment' // コメント(comment.data.comment)
    | 'name' // 名前(comment.data.name)
    | 'displayName' // ニックネーム(comment.data.displayName)
  case:
    | 'exact' // 完全一致
    | 'starts' // 前方一致
    | 'include' // 部分一致
  value: string[] // 検索ワード
}
