// src/Modules/core/ErrorHandler.ts
import { postSystemMessage } from '@api/PostOneComme'

type ErrorLevel = 'info' | 'warn' | 'error'
export function systemMessage(level: ErrorLevel, message: string, error?: unknown): void {
  const errorMessage = `${message}${error ? `: ${String(error)}` : ''}`
  console[level](errorMessage)

  // メッセージをわんコメに送信
  postSystemMessage(message, level).catch((sendError) => {
    console.error('Failed to send system message:', sendError)
  })
}
