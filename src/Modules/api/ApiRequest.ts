// src/Modules/api/ApiRequest.ts
import {
 AddonModeParams,
 DataType,
 Mode,
 OmikenType,
 ParamsType,
 PluginApiType,
 PluginStoreType,
 RequestResult
} from '@type';
import { filterTypes } from '@core/InitDataLoader';
import { systemMessage } from '@core/ErrorHandler';
import { PluginRequest, PluginResponse } from '@onecomme.com/onesdk/types/Plugin';

export class RequestHandler {
 constructor(private readonly responseMap: PluginApiType) {}

 // リクエストの実行
 async request(req: PluginRequest): Promise<RequestResult> {
  try {
   const { params, body } = req;
   const typedParams = params as unknown as ParamsType;

   switch (typedParams.mode) {
    // Ping
    case Mode.Ping:
     return { response: this.handlePing() };
    // 各データ取得
    case Mode.Data:
     return { response: this.handleSingleData(typedParams) };
    // すべてのデータ取得(エディター用)
    case Mode.AllData:
     return { response: this.handleAllData() };
    // おみくじデータの永続化(エディター用)
    case Mode.Store:
     return this.updateOmikenData(typedParams, body.data);
    // バックアップ(未実装)
    case Mode.Backup:
     return { response: this.createResponse(501, 'バックアップの取得は未実装') };
    // アドオン
    case Mode.Addon:
     return this.handleAddonRequest(typedParams, body.data);
    default:
     return { response: this.createResponse(400, '無効なモード') };
   }
  } catch (e) {
   systemMessage('warn', 'リクエスト処理中にエラーが発生:', e);
   return { response: this.createResponse(500, 'データ処理中にエラーが発生しました') };
  }
 }

 // 接続確認
 private handlePing(): PluginResponse {
  return this.createResponse(
   200,
   JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString()
   })
  );
 }

 // 個別データの取得
 private handleSingleData(params: ParamsType): PluginResponse {
  if (params.mode !== Mode.Data) return this.createResponse(400, 'モードが異なるため取得できません');
  if (!params.type) return this.createResponse(400, 'タイプパラメータが必要です');

  const data = this.responseMap[params.type];
  return data ? this.createResponse(200, JSON.stringify(data)) : this.createResponse(400, '無効なタイプ');
 }

 // 一括でのデータ取得処理
 private handleAllData(): PluginResponse {
  const allData = Object.fromEntries(Object.values(DataType).map((type) => [type, this.responseMap[type]]));

  return Object.values(allData).some((data) => data == null)
   ? this.createResponse(500, '一部データの取得に失敗しました')
   : this.createResponse(200, JSON.stringify(allData));
 }

 // おみくじデータの更新
 private async updateOmikenData(params: ParamsType, newOmiken: OmikenType): Promise<RequestResult> {
  if (params.type !== DataType.Omiken) {
   return { response: this.createResponse(400, '永続化できる現在のタイプはOmikenのみです') };
  }
  try {
   this.responseMap.store.set('Omiken', newOmiken);
   Object.assign(this.responseMap, {
    Omiken: newOmiken,
    OmikenTypesArray: filterTypes(newOmiken.types, newOmiken.rules)
   });
   return {
    response: this.createResponse(200, 'ファイルが正常に保存されました'),
    data: this.responseMap
   };
  } catch (error) {
   console.error('エラー:', error);
   return { response: this.createResponse(400, 'データ処理中にエラーが発生しました') };
  }
 }

 // おみくじデータの更新
 private async updateOmikenData(newOmiken: OmikenType): Promise<void> {
  // 派生データの生成に失敗した場合、永続データを先に上書きしない
  const OmikenTypesArray = filterTypes(newOmiken.types, newOmiken.rules);

  this.responseMap.store.set('Omiken', newOmiken);
  Object.assign(this.responseMap, {
   Omiken: newOmiken,
   OmikenTypesArray
  });
 }

 // 共通レスポンスの生成
 private createResponse(code: number, response: string): PluginResponse {
  return { code, response };
 }
}
