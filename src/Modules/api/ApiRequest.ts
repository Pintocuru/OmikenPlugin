// src/Modules/api/ApiRequest.ts
import { DataType, Mode, OmikenType, ParamsType, StoreApiType } from '@type';
import { filterTypes } from '@core/InitDataLoader';
import { systemMessage } from '@core/ErrorHandler';
import { PluginRequest, PluginResponse } from '@onecomme.com/onesdk/types/Plugin';

type RequestResult = {
 response: PluginResponse;
 data?: StoreApiType;
};
export class RequestHandler {
 constructor(private readonly responseMap: StoreApiType) {}

 // リクエストの実行
 async request(req: PluginRequest): Promise<RequestResult> {
  try {
   const { method, params, body } = req;
   const typedParams = params as unknown as ParamsType;

   return method === 'GET'
    ? { response: this.handleGet(typedParams) }
    : method === 'POST'
    ? this.handlePost(typedParams, body)
    : { response: this.createResponse(404, 'サポートされていないメソッド') };
  } catch (e) {
   systemMessage('warn', 'リクエスト処理中にエラーが発生:', e);
   return { response: this.createResponse(500, 'データ処理中にエラーが発生しました') };
  }
 }

 // GET リクエストの処理
 private handleGet(params: ParamsType): PluginResponse {
  const handlers: Record<Mode, () => PluginResponse> = {
   [Mode.Ping]: () => this.handlePing(),
   [Mode.AllData]: () => this.handleAllData(),
   [Mode.Data]: () => this.handleSingleData(params),
   [Mode.Backup]: () => this.createResponse(501, 'バックアップの取得は未実装')
  };

  return handlers[params.mode]?.() ?? this.createResponse(400, '無効なリクエストモード');
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

 // 一括でのデータ取得処理
 private handleAllData(): PluginResponse {
  const allData = Object.fromEntries(Object.values(DataType).map((type) => [type, this.responseMap[type]]));

  return Object.values(allData).some((data) => data == null)
   ? this.createResponse(500, '一部データの取得に失敗しました')
   : this.createResponse(200, JSON.stringify(allData));
 }

 // 個別データの取得
 private handleSingleData(params: ParamsType): PluginResponse {
  if (!params.type) return this.createResponse(400, 'タイプパラメータが必要です');

  const data = this.responseMap[params.type];
  return data ? this.createResponse(200, JSON.stringify(data)) : this.createResponse(400, '無効なタイプ');
 }

 // POST リクエストの処理
 private async handlePost(params: ParamsType, body: { headers: any; data: any }): Promise<RequestResult> {
  if (params.mode !== Mode.Backup) {
   return { response: this.createResponse(400, '無効なタイプパラメータ') };
  }

  // Mode.Backup
  try {
   await this.updateOmikenData(body.data);
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