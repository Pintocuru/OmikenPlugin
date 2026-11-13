// src/plugin.mockData.ts

import { StoreType } from '../Modules/type'
const { CONFIG } = require('./config.js')
import { Comment } from '@onecomme.com/onesdk/types/Comment'
import ElectronStore from 'electron-store'
import fs from 'fs'

// テストコメント
export const commentMock: Comment = {
  id: 'COMMENT_TESTER',
  service: 'external',
  name: 'CommentTester',
  url: '',
  color: { r: 0, g: 0, b: 0 },
  data: {
    comment: 'じゃんけん',
    id: 'yt-1733023389806',
    liveId: 'youtube-test',
    userId: 'テストユーザー',
    name: 'テスト',
    isOwner: false,
    timestamp: '2037-12-01T03:23:09.806Z',
    badges: [],
    hasGift: false,
    profileImage: '',
    displayName: 'テスト',
    originalProfileImage: '',
    meta: {},
    speechText: 'テ',
  },
  meta: { interval: 999990, tc: 1, no: 1, lc: 11 },
}

// プラグインデータモック
const mockFilePath = `C:/Users/curuu/AppData/Roaming/onecomme/plugins/${CONFIG.PLUGIN_UID}/state.json`
export const stateMock: StoreType = JSON.parse(fs.readFileSync(mockFilePath, 'utf-8'))

// ElectronStoreモックの作成
export const storeMock = {
  get: jest.fn((key: string) => {
    const keys = key.split('.')
    let value = stateMock
    for (const k of keys) {
      value = value[k]
    }
    return value
  }),
  set: jest.fn((key: string, value: any) => {
    const keys = key.split('.')
    let current = stateMock
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]]
    }
    current[keys[keys.length - 1]] = value
  }),
} as unknown as ElectronStore<StoreType>

// ElectronStore の代替品
export class MockElectronStore {
  private storeData: Record<string, any>

  constructor(initialData: StoreType = stateMock) {
    // 初期データをstoreDataにセット
    this.storeData = { ...initialData }
  }

  get<T>(key: string, defaultValue: T): T {
    // キーをドット区切りで探索
    const keys = key.split('.')
    let value = this.storeData

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        return defaultValue
      }
    }

    return (value as T) || defaultValue
  }

  set<T>(key: string, value: T): void {
    // キーをドット区切りで探索し、最終キーに値をセット
    const keys = key.split('.')
    let current = this.storeData

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i]
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {}
      }
      current = current[k]
    }

    current[keys[keys.length - 1]] = value
  }
}
