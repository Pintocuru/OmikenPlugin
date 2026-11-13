'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
const WinChan_1 = __importDefault(require('./WinChan'))
const SCRIPTPARAMS = [
  {
    id: 'isRank',
    name: '結果をランキングに入れるか',
    description: 'OFFなら、ランキングに影響を与えません',
    type: 'boolean',
    value: true,
  },
  {
    id: 'isBomber',
    name: 'WordPartyで音を鳴らすか',
    description: '1:鳴らす/0:OFF 別途専用WordPartyが必要です',
    isEver: true,
    type: 'boolean',
    value: true,
  },
]
const PLACEHOLDERS = [
  {
    id: 'message',
    name: '標準メッセージ',
    description: 'デフォルトのボンバースピンの返答',
    value: 'userのセブンスピン!1/4/8000!合計$8004枚獲得!',
  },
  {
    id: 'symbol',
    name: 'シンボル',
    description: '当選した図柄を返します',
    value: 'セブン',
  },
  {
    id: 'payout',
    name: '獲得したポイント',
    description: '獲得したポイントを返します',
    value: '8004',
  },
  {
    id: 'winsRank',
    name: '順位',
    description: '今回の順位を返します',
    value: '1',
  },
]
const payoutTable = [
  { payouts: [0, 0, 1, 2, 10, 40, 200, 1000], symbol: 'チェリー', img: '!bombcherry' },
  { payouts: [0, 0, 1, 2, 15, 60, 300, 1500], symbol: 'オレンジ', img: '!bomborange' },
  { payouts: [0, 0, 1, 4, 20, 80, 400, 2000], symbol: 'プラム', img: '!bombplam' },
  { payouts: [0, 0, 2, 6, 30, 120, 600, 3000], symbol: 'スイカ', img: '!bombmelon' },
  { payouts: [0, 1, 2, 8, 40, 160, 800, 4000], symbol: 'ベル', img: '!bombbell' },
  { payouts: [0, 1, 2, 10, 50, 200, 1000, 5000], symbol: 'ハット', img: '!bombhut' },
  { payouts: [0, 1, 3, 15, 60, 240, 1200, 6000], symbol: 'BAR', img: '!bombBAR' },
  { payouts: [0, 1, 4, 30, 80, 320, 2000, 8000], symbol: 'セブン', img: '!bombseven' },
]
const winComments = [
  [10000, '👑JACKPOT👑'],
  [5000, '💎EPIC WIN💎'],
  [2500, '♕FEVER♕'],
  [1000, '🎯大当り🎯'],
  [500, '✌あたり✌'],
]
const plugin = {
  id: 'BomberSpin',
  name: 'ボンバースピン',
  description: 'APPLI BOMBERSPIN2風のおみくじ',
  version: '0.0.1',
  author: 'Pintocuru',
  tags: ['ポイント', 'ランキング', 'スロット'],
  url: '',
  banner: '',
  func: (game, comment, params) => {
    const { isBomber, isRank } = params
    const { symbol, img, payout, message } = playGacha(comment.data.displayName)
    const winParams = {
      getPoint: payout,
      isRank,
      rankMode: 2,
      rankDays: 20,
      historyDays: 10,
    }
    const result = WinChan_1.default.func(game, comment, winParams)
    const { winsRank } = result.placeholder
    return {
      postArray: isBomber
        ? [
            { type: 'party', delaySeconds: 0, content: '!bombback' },
            { type: 'party', delaySeconds: 0, content: img },
            { type: 'party', delaySeconds: 1.8, content: '!bombfire' },
          ]
        : [],
      placeholder: {
        message,
        symbol,
        payout,
        winsRank,
      },
      game: result.game,
    }
  },
  scriptParams: SCRIPTPARAMS,
  placeholders: PLACEHOLDERS,
}
exports.default = plugin
function arraySelect(weights) {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let random = Math.random() * total
  return weights.findIndex((weight) => {
    random -= weight
    return random <= 0
  })
}
const rerollWilds = (count) =>
  Array(count)
    .fill(0)
    .reduce((acc) => acc + Number(Math.random() < 1 / 16), 0)
function playGacha(user) {
  const baseSpins = arraySelect([12, 11, 10, 9, 8, 7, 6, 5]) + 1
  const spins = Math.max(2, Math.min(7, baseSpins - Math.floor(Math.random() * 4)))
  const symbolIndex = arraySelect([14, 13, 12, 11, 10, 9, 8, 7])
  const { symbol, img, payouts } = payoutTable[symbolIndex]
  let emptySlots = 7 - Math.floor(Math.random() * 3)
  let totalPayout = payouts[7 - emptySlots + rerollWilds(emptySlots)]
  if (totalPayout < 10) totalPayout++
  let message = `${user}の${symbol}スピン!${totalPayout}/`
  for (let j = spins; j > 0; j--) {
    const threshold = (20 - symbolIndex * 2 + 20 / j) / 100
    const hits = Array(emptySlots)
      .fill(0)
      .reduce((acc) => acc + Number(Math.random() < threshold), 0)
    emptySlots -= hits
    let payout = payouts[7 - emptySlots + rerollWilds(emptySlots)]
    if (payout < 10) payout++
    totalPayout += payout
    message += j === 1 ? `${payout}!` : `${payout}/`
  }
  const winComment = winComments.find(([threshold]) => totalPayout >= threshold)?.[1] || ''
  message += winComment + `合計${totalPayout}枚獲得!`
  return { symbol, img, payout: totalPayout, message }
}
