// src/Modules/settings.ts
import path from 'path'

// ルートディレクトリ名を取得
const rootDirName = path.basename(path.resolve(__dirname))
const PLUGIN_UID = rootDirName || 'OmikenPlugin01'

// 環境変数 NODE_ENV=development を設定していれば開発、そうでないなら本番
process.env.NODE_ENV = process.env.NODE_ENV || 'production'
const isProduction = process.env.NODE_ENV === 'development'

// 設定オブジェクト SETTINGS
export const SETTINGS: Settings = {
  imgRoot: isProduction // dataのディレクトリ
    ? 'data/Charas' // 開発環境用
    : `../../../plugins/${PLUGIN_UID}/Charas`, // 本番環境用
  dataRoot: isProduction // dataのディレクトリ
    ? path.join(__dirname, '../../../data') // 開発環境用
    : path.join(__dirname, ''), // 本番環境用
  ScriptsRoot: isProduction // gameのディレクトリ
    ? path.join(__dirname, 'data/Scripts') // 開発環境用
    : path.join(__dirname, 'Scripts'), // 本番環境用
  isCreateService: true, // わんコメに自動で枠を作成してもいいか
  BASE_URL: 'http://localhost:11180/api', // わんコメのapi
  basicDelaySeconds: 1, // わんコメに投稿する際の基本遅延(秒)
  PLUGIN_UID,
  BOT_USER_ID: 'FirstCounter',
  BOT_DEFAULT_NAME: 'おみくじBOT',
}

interface Settings {
  imgRoot: string
  dataRoot: string
  ScriptsRoot: string
  isCreateService: boolean
  BASE_URL: string
  basicDelaySeconds: number
  PLUGIN_UID: string
  BOT_USER_ID: string
  BOT_DEFAULT_NAME: string
}
