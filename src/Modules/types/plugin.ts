// src/types/plugin.ts

import { OmikenType, OmikujiType, RulesType, TypesType } from './Omiken'
import { CharaType, ScriptParam, ScriptsType } from './preset'
import { Service } from '@onecomme.com/onesdk/types/Service'
import { BaseResponse } from '@onecomme.com/onesdk/types/BaseResponse'
import { Colors, Comment } from '@onecomme.com/onesdk/types/Comment'
import { UserNameData } from '@onecomme.com/onesdk/types/UserData'
import { PluginResponse } from '@onecomme.com/onesdk/types/Plugin'

// ---------------------------------------------------

// ElectronStore用の型
export interface PluginStoreType {
  Omiken: OmikenType
  Visits: Record<string, VisitType>
  Games: Record<string, GameType>
}

// おみくじBOT用の型
export interface PluginMainType extends PluginStoreType {
  store: any // ElectronStore不具合のためany ElectronStore<StoreType>
  OmikenTypesArray?: Record<TypesType, RulesType[]>
  Charas: Record<string, CharaType>
  Scripts: Record<string, ScriptsType>
  TimeConfig: TimeConfigType
}

// API用の型
export interface PluginApiType extends PluginStoreType {
  store: any // ElectronStore不具合のためany ElectronStore<StoreType>
  Presets: Record<string, OmikenType>
  Charas: Record<string, CharaType>
  Scripts: Record<string, ScriptsType>
}

// 全体設定用の型
export interface PluginAllType extends PluginMainType {
  Presets: Record<string, OmikenType>
  filterCommentProcess(comment: Comment, userData: UserNameData): Promise<void>
  timerSelector: any // プラグイン専用の型なのでany
}

// プラグインのデータを更新するreturn用の型
export interface PluginUpdateData {
  Games?: Record<string, GameType>
  Visits?: Record<string, VisitType>
  TimeConfig?: TimeConfigType
}

// ---

// ユーザーデータ(全体)
export interface VisitType {
  name: string // ユーザー名(ニックネーム)
  userId: string // ユーザーID
  round: number // コメントした配信枠の数
  status: string // 任意のステータス(共通)
  point: number // 任意のポイント(共通)
  lastPluginTime: number // 前回コメントした配信枠のactiveTime
}

interface DrawsType {
  draws: number // 配信枠での、おみくじ回数
  totalDraws: number // おみくじの総回数
}

// おみくじデータ
export interface GameType extends DrawsType {
  ruleId: string // rulesのID(key)
  settings: ScriptParam[] // scriptParamsで設定したisEverのデータが入る
  userStats: Record<string, UserStatsType>
  currentUserIds: string[] // ユーザー履歴
  [key: string]: any // scriptで自由に使えるObject
}

// ユーザーデータ
export interface UserStatsType extends DrawsType {
  userId: string
  name?: string // 名前
  wins?: number // 配信枠での、おみくじ勝利数
  totalWins?: number // おみくじの総勝利数
  points?: number // 配信枠での、おみくじポイント数
  totalPoints?: number // おみくじの総ポイント数
  status?: string // おみくじのステータス
  items?: Record<string, string> // おみくじで得たアイテム
  lastPlayed?: string // 最終プレイ日時
}

// ---

// 選択したおみくじ
export interface OmikujiSelectType extends OmikujiType {
  selectRuleId: string // 選択されたルールのid
}

// TimeConfig
export interface TimeConfigType {
  pluginTime: number // プラグインを起動した時刻
  lc: number // プラグインを起動してからカウントしたコメント数
  lastTime: number // 最後におみくじ機能が実行された時刻
  lastUserId: string // TODO 廃止(Gamesが担う) 最後におみくじを行ったuserId
}

// ---

// わんコメSend Commentの型定義
export interface SendCommentType {
  service: Pick<Service, 'id'>
  comment: Pick<
    BaseResponse,
    | 'id' // SendCommentParamsType で使用
    | 'userId' // ユーザー識別ID
    | 'name' // 表示名
    | 'nickname' // ユーザーネームの読み上げ変更
    | 'comment' // コメント
    | 'profileImage' // アイコン
    | 'badges' // メンバーやモデレーター等の表示用バッジ
  > & { color?: Colors }
}

// わんコメSend Commentでidを利用したパラメータ受け渡しに使う型定義
export interface SendCommentParamsType {
  id: string // 一意のID
  charaId: string // キャラID
  param?: string // ジェネレーターに渡す引数(omikuji.generatorParam)
  isSilent?: string // BOTの読み上げを行わない(omikuji.isSilent)
  [key: string]: string | undefined
}

// わんコメSend Test Comment型定義
export interface SendTestCommentType {
  platform: string
  hasGift: boolean
  unit: string
  price: number
  giftType: string
  newComment: boolean
  repeater: boolean
  subscribe: boolean
  speech: boolean
  username: string
  comment: string
}

// ---

// APIの返り値の型定義
export type RequestResult = {
  response: PluginResponse
  data?: Partial<PluginApiType>
}

// API用

// パラメータの型定義
export type ParamsType =
  PingModeParams | DataModeParams | AllDataModeParams | StoreModeParams | BackupModeParams | AddonModeParams

// Ping用型定義
interface PingModeParams {
  method: 'GET'
  mode: Mode.Ping
  type?: never
}

// データ取得用型定義
interface DataModeParams {
  method: 'GET'
  mode: Mode.Data
  type: DataType.Omiken | DataType.Presets | DataType.Charas | DataType.Scripts | DataType.Visits | DataType.Games
}

// 一括でのデータ取得用型定義
interface AllDataModeParams {
  method: 'GET'
  mode: Mode.AllData
  type?: never
}

// ストア（永続化）用型定義
interface StoreModeParams {
  method: 'POST'
  mode: Mode.Store
  type: DataType.Omiken | DataType.Visits | DataType.Games
}

// バックアップ用型定義
interface BackupModeParams {
  method: 'POST'
  mode: Mode.Backup
  type: DataType.Omiken | DataType.Presets
}

// アドオン用型定義
export interface AddonModeParams {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  mode: Mode.Addon
  type: never
  scriptId: string // Scripts にある script.id を指定
  ruleId?: string // Games にある rule.id を指定（省略可）
}

// モードを定義
export enum Mode {
  Ping = 'ping', // ping取得
  Data = 'data', // 各種データ取得
  AllData = 'allData', // すべてのデータ取得(エディター用)
  Store = 'store', // おみくじデータの永続化(エディター用)
  Backup = 'backup', // バックアップ(エディター用)
  Addon = 'addon', // アドオン用
}

// データの種類を定義
export enum DataType {
  Omiken = 'Omiken', // おみくじデータ
  Presets = 'Presets', // preset(おみくじデータ)
  Charas = 'Charas', // キャラデータ
  Scripts = 'Scripts', // スクリプト
  Visits = 'Visits', // 個人データ
  Games = 'Games', // スクリプトデータ
}
