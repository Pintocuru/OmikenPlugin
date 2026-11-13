// src/Modules/tasks/OmikujiProcess.ts

import {
 GameType,
 OmikujiSelectType,
 PluginUpdateData,
 ScriptParam,
 ScriptsReturnType,
 ScriptsType,
 PluginMainType,
 PluginStoreType,
 UserStatsType,
 VisitType
} from '@type';
import { systemMessage } from '@core/ErrorHandler';
import { PlaceProcess } from '@tasks/PlaceProcess';
import { PostMessage } from '@api/PostMessage';
import { Comment } from '@onecomme.com/onesdk/types/Comment';

// 型定義の改善
type OmikujiContext = {
 game: GameType & {
  userStats: Record<string, UserStatsType>;
 };
 visit?: VisitType;
};

export class OmikujiProcessor {
 private context: OmikujiContext = {} as OmikujiContext;
 private placeProcessor?: PlaceProcess;

 constructor(
  private readonly storeAll: PluginMainType,
  private readonly omikuji: OmikujiSelectType,
  private readonly comment?: Comment
 ) {
  this.placeProcessor = new PlaceProcess(omikuji);
  this.setupContext();
 }

 // ユーザーStats取得用のgetter
 private getCurrentUserStats(): UserStatsType | undefined {
  if (!this.comment) return undefined;
  const userId = this.comment.data.userId;
  return this.context.game.userStats[userId];
 }

 // ユーザーStats更新用のメソッド
 private updateUserStats(updates: Partial<UserStatsType>): void {
  if (!this.comment) return;
  const userId = this.comment.data.userId;

  this.context.game.userStats[userId] = {
   ...this.getCurrentUserStats(),
   ...updates,
   userId
  };
 }

 private setupContext() {
  // ゲームの初期化
  this.context.game = this.storeAll.Games[this.omikuji.selectRuleId] ?? {
   ruleId: this.omikuji.selectRuleId,
   draws: 0,
   totalDraws: 0,
   settings: [],
   currentUserIds: [],
   userStats: {}
  };

  // 訪問データの設定
  if (this.comment) {
   const userId = this.comment.data.userId;
   this.context.visit = this.storeAll.Visits[userId];

   // userStatsの初期化（必要な場合）
   if (!this.getCurrentUserStats()) {
    this.updateUserStats({
     userId: this.comment.data.userId,
     name: this.comment.data.name,
     draws: 0,
     totalDraws: 0
    });
   }
  }
 }

 async process(): Promise<Partial<PluginStoreType>> {
  this.updateDrawsStatus();
  await this.executeScript();
  this.processPlaceData();
  void this.postFinalMessages().catch((error) => {
   systemMessage('error', 'おみくじの投稿に失敗しました', error);
  });
  this.storeChanges();
  return this.pluginsUpdate();
 }

 private updateDrawsStatus() {
  const userId = this.comment?.data.userId;
  if (!userId) return;

  // game情報の更新
  this.context.game = {
   ...this.context.game,
   ruleId: this.omikuji.selectRuleId,
   draws: (this.context.game.draws ?? 0) + 1,
   totalDraws: (this.context.game.totalDraws ?? 0) + 1,
   currentUserIds: [userId, ...(this.context.game.currentUserIds || [])].slice(0, 10)
  };

  // userStatsの更新
  this.updateUserStats({
   userId: this.comment.data.userId,
   name: this.comment.data.name,
   draws: (this.getCurrentUserStats()?.draws ?? 0) + 1,
   totalDraws: (this.getCurrentUserStats()?.totalDraws ?? 0) + 1,
   ...(this.omikuji.status && { status: this.omikuji.status })
  });
 }

 // Scriptsの読み込み
 private async executeScript() {
  if (!this.omikuji.script) return;

  const scriptResult = await this.scriptsCall();

  if (scriptResult) {
   // プレース情報の更新
   this.placeProcessor.updatePlace(scriptResult.placeholder);

   // postArrayがあるなら、わんコメに投稿
   if (scriptResult.postArray?.length > 0) {
    void new PostMessage(scriptResult.postArray, this.storeAll.Charas).post().catch((error) => {
     systemMessage('error', '外部スクリプトからの投稿に失敗しました', error);
    });
   }

   // game情報を更新
   if (scriptResult.game) this.context.game = scriptResult.game;
  }
 }

 // 外部スクリプトの実行
 private async scriptsCall(): Promise<ScriptsReturnType | undefined> {
  try {
   const { scriptId, params } = this.omikuji.script;
   const scriptData = this.storeAll.Scripts[scriptId];

   if (!this.isValidScript(scriptData)) return undefined;

   const processedParams = this.processScriptParams(scriptData.scriptParams, params, this.context.game.settings);

   return scriptData.func(this.context.game, this.comment, processedParams);
  } catch (error) {
   this.handleScriptError(error);
   return undefined;
  }
 }

 private processScriptParams(
  scriptParams: ScriptParam[],
  inputParams: Record<string, string | number | boolean>,
  settings: ScriptParam[] = []
 ): { [id: string]: string | number | boolean } {
  // 永続化設定の更新
  this.updateGameSettings(scriptParams, settings);

  // パラメータの型変換
  const convertedParams = this.convertInputParams(scriptParams, inputParams);

  // パラメータの統合（優先順位: converted > settings > default）
  return scriptParams.reduce(
   (acc, param) => ({
    ...acc,
    [param.id]: convertedParams[param.id] ?? settings.find((s) => s.id === param.id)?.value ?? param.value
   }),
   {}
  );
 }

 // 設定の更新
 private updateGameSettings(scriptParams: ScriptParam[], settings: ScriptParam[]): void {
  const mergedSettings = new Map(
   [...settings, ...scriptParams.filter((param) => param.isEver)].map((param) => [param.id, param])
  );

  this.context.game.settings = Array.from(mergedSettings.values());
 }

 private convertInputParams(
  scriptParams: ScriptParam[],
  inputParams: Record<string, string | number | boolean>
 ): { [id: string]: string | number | boolean } {
  const result: { [id: string]: string | number | boolean } = {};

  for (const param of scriptParams) {
   if (Object.prototype.hasOwnProperty.call(inputParams, param.id)) {
    result[param.id] = this.convertScriptParam(inputParams[param.id], param.type);
   }
  }

  return result;
 }

 private isValidScript(scriptData: ScriptsType): boolean {
  if (!scriptData || typeof scriptData.func !== 'function') {
   systemMessage('warn', `外部スクリプトが読み込めません`, scriptData);
   return false;
  }
  return true;
 }

 private handleScriptError(e: unknown): void {
  systemMessage('error', `外部スクリプトエラー`, e);
  throw new Error();
 }

 // typeを参照し、paramsの文字列をnumber/booleanに変換
 private convertScriptParam(
  value: string | number | boolean,
  type: ScriptParam['type'] = 'string'
 ): string | number | boolean {
  try {
   switch (type) {
    case 'number':
     const num = Number(value);
     return isNaN(num) ? 0 : num;
    case 'boolean':
     if (typeof value === 'string') {
      return ['true', '1', 'yes'].includes(value.toLowerCase());
     }
    default:
     return value;
   }
  } catch (error) {
   console.error(`Parameter conversion error: ${error}`);
   return value;
  }
 }

 // プレースホルダーの値を設定
 private processPlaceData() {
  const { placeIds } = this.omikuji;
  const currentUserStats = this.getCurrentUserStats();
  const commentData = this.comment?.data;
  const commentMeta = this.comment?.meta;

  if (placeIds) {
   this.placeProcessor.placeDataHandle(this.storeAll.Omiken.places);
  }

  const placeholder = {
   gameDraws: this.context.game.draws ?? 0,
   gameTotalDraws: this.context.game.totalDraws ?? 0,
   ...(commentData &&
    commentMeta && {
     draws: currentUserStats?.draws ?? 0,
     totalDraws: currentUserStats?.totalDraws ?? 0,
     user: commentData.displayName || commentData.name,
     tc: commentMeta?.tc,
     lc: commentMeta?.lc,
     round: commentMeta?.no
    })
  };

  this.placeProcessor.updatePlace(placeholder);
 }

 private storeChanges() {
  // 永続化
  this.storeAll.store.set(`Games.${this.omikuji.selectRuleId}`, this.context.game);

  if (this.comment && this.context.visit) {
   this.storeAll.store.set(`Visits.${this.comment.data.userId}`, this.context.visit);
  }
 }

 private pluginsUpdate(): PluginUpdateData {
  const result: PluginUpdateData = {
   Games: {
    ...this.storeAll.Games,
    [this.omikuji.selectRuleId]: this.context.game
   }
  };

  if (this.comment && this.context.visit) {
   result.TimeConfig = {
    ...this.storeAll.TimeConfig,
    lastTime: Date.now(),
    lastUserId: this.comment.data.userId
   };
   result.Visits = {
    ...this.storeAll.Visits,
    [this.comment.data.userId]: { ...this.context.visit }
   };
  }

  return result;
 }

 private async postFinalMessages() {
  // プレースホルダーを置き換え、投稿するデータを用意
  const finalOmikuji = this.placeProcessor.replacementPlace();
  await new PostMessage(finalOmikuji.post, this.storeAll.Charas).post();
 }
}
