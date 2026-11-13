// src/Modules/api/BackupService.ts
import { systemMessage } from '@core/ErrorHandler'
import { SETTINGS } from '@/Modules/settings'
import fs from 'fs'
import path from 'path'

export class BackupService {
  private backupDir: string

  constructor(backupDir: string = 'Omiken') {
    this.backupDir = path.join(SETTINGS.dataRoot, backupDir)

    // バックアップディレクトリが存在しない場合は作成
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true })
    }
  }

  // 現在の日時をファイル名に使用するメソッド
  private generateBackupFilename(): string {
    const timestamp = new Date().toISOString().replace(/[:\.]/g, '-')
    return `backup_${timestamp}.json`
  }

  // バックアップを作成するメソッド
  createBackup(data: any): string {
    try {
      const backupFilename = this.generateBackupFilename()
      const backupPath = path.join(this.backupDir, backupFilename)

      fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), 'utf8')
      return backupFilename
    } catch (e) {
      systemMessage('error', 'バックアップ作成エラー:', e)
      throw new Error()
    }
  }

  // バックアップファイルの一覧を取得
  listBackups(): string[] {
    return fs
      .readdirSync(this.backupDir)
      .filter((file) => path.extname(file) === '.json')
      .sort()
      .reverse() // 最新のバックアップを先頭に
  }

  // 特定のバックアップファイルを読み込む
  restoreFromBackup(filename: string): any {
    const backupPath = path.join(this.backupDir, filename)

    if (!fs.existsSync(backupPath)) {
      systemMessage('warn', '指定されたバックアップファイルが見つかりません')
    }

    const backupContent = fs.readFileSync(backupPath, 'utf8')
    return JSON.parse(backupContent)
  }

  // 古いバックアップを削除（保持する世代数を指定）
  cleanupBackups(maxBackups: number = 10): void {
    const backups = this.listBackups()
    if (backups.length > maxBackups) {
      const backupsToDelete = backups.slice(maxBackups)
      backupsToDelete.forEach((backup) => {
        fs.unlinkSync(path.join(this.backupDir, backup))
      })
    }
  }
}
