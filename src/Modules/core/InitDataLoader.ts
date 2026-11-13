// src/Modules/core/InitDataLoader.js
import {
 OmikenType,
 RulesType,
 CharaType,
 StoreType,
 GameType,
 TypesType,
 VisitType,
 TimeConfigType,
 OmikujiSelectType,
 StoreAllType,
 ScriptsType
} from '@type';
import { SETTINGS } from '@/Modules/settings';
import { systemMessage } from '@core/ErrorHandler';
import { OmikujiSelector, OmikujiSelectorTimer } from '@tasks/OmikujiSelector';
import { OmikujiProcessor } from '@tasks/OmikujiProcess';
import ElectronStore from 'electron-store';
import fs from 'fs';
import path from 'path';
import { ServiceAPI } from '../api/serviceAPI';

export class InitDataLoader {
 private store: any; // ElectronStore<StoreType> にするとエラーが出るためanyにしています。

 constructor(store: ElectronStore<StoreType>) {
  this.store = store;
 }

 // Omiken/presetデータ読み込み
 load(): Partial<StoreAllType> {
  try {
   // TODO 後でdefault値を入れたいかも
   const Omiken = this.store.get('Omiken', {}) as OmikenType;

   return {
    store: this.store,
    Omiken,
    OmikenTypesArray: filterTypes(Omiken.types, Omiken.rules),
    Presets: this.loadDirectoryContents<OmikenType>('Presets', 'json'),
    Charas: this.loadDirectoryContents<CharaType>('Charas', 'json'),
    Scripts: this.loadDirectoryContents<ScriptsType>(SETTINGS.ScriptsRoot, 'js'),
    Visits: this.store.get('Visits', {}) as Record<string, VisitType>,
    Games: this.initializeGames(),
    TimeConfig: this.initializeTimeConfig(),
    timerSelector: OmikujiSelector.create('timer') as OmikujiSelectorTimer
   };
  } catch (e) {
   systemMessage('error', `プラグインデータの読み込み中にエラーが発生`, e);
   throw new Error();
  }
 }

 // Scriptsにある関数を読み込み
 private loadDirectoryContents<T>(dirPath: string, extension: 'json' | 'js'): Record<string, T> {
  const result: Record<string, T> = {};
  const fullPath = extension === 'js' ? dirPath : path.join(SETTINGS.dataRoot, dirPath);

  try {
   const files = fs.readdirSync(fullPath).filter((file) => file.endsWith(`.${extension}`));
   files.forEach((file) => {
    const key = file.replace(`.${extension}`, '');
    const filePath = path.join(fullPath, file);

    try {
     if (extension === 'json') {
      const data = readJsonFile<T>(filePath);
      if (data !== null) result[key] = data;
     } else {
      const loaded = require(filePath);
      result[key] = loaded.default || loaded;
     }
    } catch (e) {
     systemMessage('error', `ファイルの読み込みに失敗: ${filePath}`, e);
     throw new Error(`ファイルの読み込みに失敗: ${filePath}`);
    }
   });
  } catch (e) {
   systemMessage('error', `ディレクトリの読み取りに失敗: ${fullPath}`, e);
   throw new Error(`ディレクトリの読み取りに失敗: ${fullPath}`);
  }

  return result;
 }

 // Gamesのすべてのdrawsを初期化する
 private initializeGames(): Record<string, GameType> {
  const Games = (this.store.get('Games', {}) ?? {}) as Record<string, GameType>;
  // 初期化
  const newGames = Object.fromEntries(
   Object.entries(Games).map(([key, game]) => [
    key,
    {
     ...game,
     draws: 0,
     userStats: game.userStats
      ? Object.fromEntries(
         Object.entries(game.userStats).map(([userId, userStat]) => [
          userId,
          {
           ...userStat,
           draws: 0,
           wins: userStat?.wins != null ? 0 : undefined,
           points: userStat?.points != null ? 0 : undefined,
           status: userStat?.status != null ? '' : undefined
          }
         ])
        )
      : {}
    }
   ])
  );

  // storeに格納
  this.store.set('Games', newGames);
  return newGames;
 }

 // TimeConfigを初期化する
 private initializeTimeConfig(): TimeConfigType {
  return { pluginTime: Date.now(), lc: 0, lastTime: 0, lastUserId: '' };
 }
}

// JSONファイルを読む
function readJsonFile<T>(filePath: string): T | null {
 try {
  if (!fs.existsSync(filePath)) {
   systemMessage('error', `ファイルが見つかりません: ${filePath}`);
   return null;
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const parsedData = JSON.parse(fileContent) as T;

  if (parsedData === null) {
   systemMessage('error', `無効なデータ: ${filePath}`);
  }

  return parsedData;
 } catch (error) {
  systemMessage('error', `ファイル読み込みエラー: ${filePath}`, error);
  return null;
 }
}

// rulesを配列にする
export function filterTypes(types: Record<TypesType, string[]>, rules: Record<string, RulesType>) {
 return Object.keys(types).reduce((result, typeKey) => {
  result[typeKey] = types[typeKey]
   .filter((id: string) => Object.prototype.hasOwnProperty.call(rules, id))
   .map((id: string) => rules[id]);
  return result;
 }, {} as Record<TypesType, RulesType[]>);
}

// timerのセットアップ
export async function timerSetup(StoreAll: StoreAllType) {
 // timerが空の場合、処理を終了
 if (StoreAll.OmikenTypesArray?.timer.length === 0) return;

 // timerのセットアップ
 StoreAll.timerSelector.setupTimers(
  StoreAll.OmikenTypesArray.timer,
  StoreAll.Omiken.omikujis,
  async (result: OmikujiSelectType) => {
   try {
    await new OmikujiProcessor(StoreAll, result).process();
   } catch (error) {
    systemMessage('error', 'タイマーのおみくじ処理に失敗しました', error);
   }
  }
 );
}

// データが取得できる、または枠が作成されるまで待つ
export async function startReadyCheck() {
 const CONFIG = {
  INITIAL_INTERVAL: 1000, // 最初の1秒間隔
  EXTENDED_INTERVAL: 15000, // 15秒間隔
  THRESHOLD_TIME: 10000 // 10秒間は1秒間隔で再チェック
 };
 const startTime = Date.now();

 while (true) {
  try {
   const dataArray = await new ServiceAPI().getServices();
   // 枠が作成された時点で
   if (dataArray?.length > 0) {
    console.info('Data is ready.');
    break;
   }
  } catch (error) {
   console.log('API not ready yet:', error);
  }

  const elapsedTime = Date.now() - startTime;
  const interval = elapsedTime >= CONFIG.THRESHOLD_TIME ? CONFIG.EXTENDED_INTERVAL : CONFIG.INITIAL_INTERVAL;

  // 指定された間隔で再チェック
  await new Promise((resolve) => setTimeout(resolve, interval));
 }
}
