// src/Modules/api/PostMessage.ts
import { CharaType, OneCommePostType, SendCommentParamsType, SendCommentType } from '@type';
import { postSpeech, postSystemMessage, postWordParty, sendComment } from '@api/PostOneComme';
import { ServiceAPI } from '@api/serviceAPI';
import { SETTINGS } from '@/Modules/settings';
import { Service } from '@onecomme.com/onesdk/types/Service';
import path from 'path';

export class PostMessage {
 private readonly serviceAPI: ServiceAPI;
 private services: Service[] = [];

 constructor(
  private posts: OneCommePostType[],
  private Charas?: Record<string, CharaType>
 ) {
  this.serviceAPI = new ServiceAPI();
 }

 async post(): Promise<void> {
  try {
   // 枠情報の取得
   this.services = await this.serviceAPI.getServices();

   // 各投稿を開始時刻基準のdelaySecondsで並行スケジュールし、完了を待つ
   await Promise.all(
    this.posts.map(async (post) => {
     const chara = post.type === 'onecomme' ? this.charas?.[post.botKey] : undefined;
     await this.postFork(post, chara);
    })
   );
  } catch (error) {
   console.error('Failed to post messages:', error);
   throw error;
  }
 }

 private async postFork(post: OneCommePostType, chara?: CharaType): Promise<void> {
  const { type, content, delaySeconds = 0 } = post;

  // 空のメッセージはスキップ
  if (!content?.trim()) return;

  // キャラクターの枠作成チェック
  if (type === 'onecomme' && chara && chara.isIconDisplay && SETTINGS.isCreateService) {
   const existingService = this.services.some((s) => s.id === chara.frameId);
   if (!existingService && chara.frameId !== null) {
    const newService = await this.serviceAPI.createService(
     chara.name,
     chara.frameId,
     chara.color['--lcv-background-color']
    );
    if (newService) {
     this.services.push(newService);
    }
   }
  }

  // メッセージタイプに応じた投稿処理
  const postActions: Record<string, () => Promise<void>> = {
   onecomme: async () => {
    if (post.party) await postWordParty(post.party, delaySeconds);

    // キャラクター情報があり、枠情報が取得できるなら、わんコメへ投稿
    const DefaultFrameId = this.services[0]?.id || null;
    if (chara && DefaultFrameId) {
     const request = this.createCommentRequest(post, chara, DefaultFrameId);
     await sendComment(request, delaySeconds);
    } else {
     // キャラ情報がない、または枠情報がないなら、テストコメントで投稿
     await postSystemMessage(content, 'おみくじBOT', delaySeconds);
    }
   },
   party: async () => postWordParty(content, delaySeconds),
   speech: async () => postSpeech(content, delaySeconds),
   error: async () => postSystemMessage(content, post.generatorParam, delaySeconds)
  };

  const action = postActions[type];
  if (action) await action();
 }

 private createCommentRequest(post: OneCommePostType, chara: CharaType, defaultFrameId: string): SendCommentType {
  const id: SendCommentParamsType = {
   id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
   charaId: chara.id,
   param: post.generatorParam || undefined,
   isSilent: post.isSilent?.toString() || undefined
  };
  return {
   service: {
    id: chara.frameId && chara.frameId.trim() ? chara.frameId : defaultFrameId
   },
   comment: {
    id: this.objectToKeyValueString(id),
    userId: SETTINGS.BOT_USER_ID,
    name: chara.displayName || 'おみくじBOT',
    comment: post.content,
    profileImage: this.getCharaImagePath(chara, post.iconKey),
    badges: [],
    nickname: ' '
   }
  };
 }

 private objectToKeyValueString(obj: Record<string, any>): string {
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
   .join(',');
 }

 // キャラクター画像を読み込む
 private getCharaImagePath(chara: CharaType, iconKey?: string): string {
  const charaImage = chara.image?.[iconKey ?? 'Default'];
  if (!charaImage) return DEFAULT_BASE64_IMAGE;
  return path.join(SETTINGS.imgRoot, charaImage);
 }
}

// デフォルト画像 http://flat-icon-design.com/?p=271
const DEFAULT_BASE64_IMAGE =
 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAVBJREFUeNpi/P37OQMpgImBRECuhj93Hvz/8hWPut8XrkIYLBDVH1OLgQxWA202azNmfS2Gr9+BXGYJ0V9HTv2+eBVIgszuqRM01gdpgJsNNAaIfv36ycbGDuR++PBWQEAYbsnXV6//vX6Nzw/fvn8F6kEW+fL5CxYN/2CMv/8ZMfWwQNzKoCDzi4313amLn378+P3nr3BJ+vdjZ789ec7E8P8nDy+btgrHp2//hYWgocQkIcY7s/uNrPTbL1+BqtmU5Xlc7QQzYsC2MX578fZXdPC3hqJ/IoKIYGX99Vv4yClmJhBXMCMWZLW4KFAbRPZtz0z0ePh24BiLgqyCqBCXgTaHniZEkD82iImHC6gTFPQvX0MEGSFp6d+/fy+fPWeasfiXq+0/WSm4eR+XrGMWF4FbhdAA1/Pr1y9i0xITE5O4lCQbGxsJiY8YPQABBgBWpJPZmpoVPwAAAABJRU5ErkJggg==';
