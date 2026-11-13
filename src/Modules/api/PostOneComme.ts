// src/Modules/api/PostOneComme.ts
import { SendCommentType, SendTestCommentType } from '@type'
import { SETTINGS } from '@/Modules/settings'

// わんコメへの投稿
export async function sendComment(request: SendCommentType, delaySeconds: number = 0): Promise<void> {
  return delayFetchPost(`${SETTINGS.BASE_URL}/comments`, request, delaySeconds, 'Failed to post comment')
}

// テストコメントを使ったシステムメッセージ
export async function postSystemMessage(
  content: string,
  name: string = 'error',
  delaySeconds: number = 0
): Promise<void> {
  const request: SendTestCommentType = {
    platform: 'youtube',
    hasGift: false,
    unit: '',
    price: 1000,
    giftType: 'none',
    newComment: false,
    repeater: false,
    subscribe: false,
    speech: true,
    username: name,
    comment: content,
  }

  return delayFetchPost(`${SETTINGS.BASE_URL}/comments/test`, request, delaySeconds, 'Failed to post test comment')
}

// WordPartyへの投稿
export async function postWordParty(content: string, delaySeconds: number = 0): Promise<void> {
  return delayFetchPost(
    `${SETTINGS.BASE_URL}/reactions`,
    { reactions: [{ key: content, value: 1 }] },
    delaySeconds,
    'Failed to post WordParty reaction'
  )
}

// スピーチへの投稿
export async function postSpeech(content: string, delaySeconds: number = 0): Promise<void> {
  return delayFetchPost(`${SETTINGS.BASE_URL}/speech`, { text: content }, delaySeconds, 'Failed to post speech')
}

// 遅延付きfetch.post
function delayFetchPost(url: string, data: any, delaySeconds: number, errorMessage: string): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(
      async () => {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          })

          // fetchはエラーでもHTTPステータスコードによらず正常終了するため、明示的にチェック
          if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`)
          }

          resolve()
        } catch (error) {
          console.error(errorMessage, error)
          reject(error)
        }
      },
      (delaySeconds + SETTINGS.basicDelaySeconds) * 1000
    )
  })
}
