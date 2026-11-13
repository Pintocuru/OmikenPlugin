// src/Modules/core/commentTreatment.ts
import { Comment } from '@onecomme.com/onesdk/types/Comment'
import { SendCommentParamsType, VisitType } from '@type'

export function commentTreatment(comment: Comment): Comment {
  const params = getIdParams(comment.data.id)
  if (!params) return comment

  // isOwner(isSilent) なら読み上げを行わない
  if (params?.isSilent === 'true') comment.data.speechText = ' '
  return comment
}

// comment.data.id にあるパラメータをObjectにする
const getIdParams = (str: string): SendCommentParamsType | false => {
  if (/^[0-9]+[a-zA-Z0-9]*$/.test(str)) return false

  const params = new URLSearchParams(str.replace(/,/g, '&'))
  const result: SendCommentParamsType = {
    id: params.get('id') || '',
    charaId: params.get('charaId') || '',
  }

  // パラメータを動的に処理
  params.forEach((value, key) => {
    result[key] = value
  })

  return result.id ? result : false
}

// comment.data.idをパラメータにする
export function commentParamsPlus(comment: Comment, visitData: VisitType): Comment {
  const id = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    status: visitData.status || '',
    point: visitData.point.toString() || '',
  }
  comment.data.id = objectToKeyValueString(id)

  return comment
}

function objectToKeyValueString(obj: Record<string, any>): string {
  return Object.entries(obj)
    .filter(
      ([_, value]) =>
        value !== undefined &&
        value !== 'undefined' &&
        value !== false &&
        value !== 'false' &&
        value !== null &&
        value !== 'null' &&
        value !== ''
    )
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join(',')
}
