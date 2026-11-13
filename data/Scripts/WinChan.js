'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
const SCRIPTPARAMS = [
  {
    id: 'isWin',
    name: '勝利したか',
    description: '勝敗フラグ。ユーザーの勝ち:ON/負け:OFF',
    type: 'boolean',
    value: false,
  },
  {
    id: 'getPoint',
    name: '獲得したポイント',
    description: '入力した数値を、ポイントとして加算します(プレースホルダー使用不可)',
    type: 'number',
    value: 0,
  },
  {
    id: 'isRank',
    name: '結果をランキングに入れるか',
    description: 'OFFなら、ランキングに影響を与えません',
    type: 'boolean',
    value: true,
  },
  {
    id: 'rankMode',
    name: 'ランキングモード',
    description: '0:勝数/1:レート/2:1回のポイント/3:合計ポイント',
    isEver: true,
    type: 'number',
    value: 0,
  },
  {
    id: 'historyDays',
    name: '履歴を残す回数',
    description: 'この配信回数を超えると、古いランキングから消去されます',
    isEver: true,
    type: 'number',
    value: 10,
  },
]
const PLACEHOLDERS = [
  {
    id: 'winsCount',
    name: 'ユーザーの勝利数',
    description: 'コメントしたユーザーの、配信枠内での勝数を返します',
    value: '2',
  },
  {
    id: 'winsRank',
    name: 'ユーザーの順位',
    description: 'パラメータのランキングモードを参照し、配信枠内での順位を数値で返します',
    value: '4',
  },
  {
    id: 'winsRate',
    name: 'ユーザーの勝率(%)',
    description: 'コメントしたユーザーの、配信枠内での勝率を返します',
    value: '16.6',
  },
]
const plugin = {
  id: 'WinChan',
  name: '勝率判定ちゃん',
  description: 'パラメータを受け取ることで、ゲーム数や勝率を生成します。',
  version: '0.0.2',
  author: 'Pintocuru',
  tags: ['ベース', '勝数', 'ポイント', '勝率', 'ランキング'],
  url: '',
  banner: '',
  func: (game, comment, params) => updateGame(game, comment.data.userId, params),
  scriptParams: SCRIPTPARAMS,
  placeholders: PLACEHOLDERS,
}
exports.default = plugin
const updateGame = (game, userId, params) => {
  const { getPoint, historyDays } = params
  const updatedStats = updateStats(game.userStats[userId], params, getPoint)
  const updatedUserStats = { ...game.userStats, [userId]: updatedStats }
  const rankingManager = new RankingManager(game, updatedUserStats, params, userId)
  const rankings = rankingManager.selectRankings()
  const rankingHistory = rankingManager.updateHistory(rankings, historyDays)
  return {
    placeholder: calculatePlaceholders(updatedStats, rankings, userId, params),
    game: {
      ...game,
      rankings,
      rankingHistory,
      userStats: updatedUserStats,
    },
  }
}
function updateStats(userStats, params, points) {
  const stats = { ...userStats }
  const { rankMode, isWin } = params
  const updateField = (target, field, value) => {
    const totalField = `total${field.charAt(0).toUpperCase()}${field.slice(1)}`
    target[field] = rankMode === 2 ? value : (target[field] || 0) + value
    target[totalField] = (target[totalField] || 0) + value
  }
  if (isWin) updateField(stats, 'wins', 1)
  if (points > 0) updateField(stats, 'points', points)
  return stats
}
class RankingManager {
  constructor(game, userStats, params, userId) {
    this.game = game
    this.userStats = userStats
    this.params = params
    this.userId = userId
  }
  selectRankings() {
    if (!this.params.isRank) return this.game.rankings
    if (this.params.rankMode === 2) return this.pointRankings()
    return this.totalRankings()
  }
  updateHistory(rankings, historyDays) {
    const { rankingHistory = [] } = this.game
    const today = new Date().toISOString().split('T')[0]
    if (this.game.draws <= 1) {
      this.game.age = Number.isFinite(this.game.age) ? this.game.age + 1 : 1
      const emptyRankings = []
      rankingHistory.unshift({
        date: today,
        age: this.game.age,
        rankings: emptyRankings,
      })
      return rankingHistory.slice(0, Math.max(0, Math.floor(historyDays)))
    }
    if (rankingHistory[0]) rankingHistory[0].rankings = rankings.slice(0, 10)
    return rankingHistory
  }
  pointRankings() {
    const rankingsOld = this.game.draws <= 1 ? [] : [...(this.game.rankings || [])]
    const thisUser = this.userStats[this.userId || '']
    const newEntry = {
      userId: this.userId || '',
      name: thisUser?.name || 'Unknown',
      points: thisUser?.points || 0,
    }
    const rankings = [...rankingsOld, newEntry]
      .sort((a, b) => b.points - a.points)
      .map((entry, index) => ({ ...entry, rank: index + 1 }))
    return this.prioritizeCurrentUser(rankings, this.userId)
  }
  totalRankings() {
    const rankMap = {
      0: 'wins',
      1: 'rate',
      3: 'points',
    }
    const rankingsOld = this.game.draws <= 1 ? [] : [...(this.game.rankings || [])]
    const updatedRankings = Object.entries(this.userStats)
      .map(([id, stats]) => {
        const oldRanking = rankingsOld.find((rank) => rank.userId === id)
        return {
          userId: id,
          name: stats.name,
          draws: stats.draws ?? oldRanking?.draws ?? 0,
          wins: stats.wins ?? oldRanking?.wins ?? 0,
          points: stats.points ?? oldRanking?.points ?? 0,
          rate: stats.draws > 0 ? ((stats.wins || 0) / stats.draws) * 100 : 0,
        }
      })
      .sort((a, b) => (b[rankMap[this.params.rankMode]] ?? 0) - (a[rankMap[this.params.rankMode]] ?? 0))
      .map((entry, index) => ({ ...entry, rank: index + 1 }))
    return this.prioritizeCurrentUser(updatedRankings, this.userId)
  }
  prioritizeCurrentUser(rankings, currentUserId) {
    if (!currentUserId) return rankings
    const currentUserIndex = rankings.findIndex((rank) => rank.userId === currentUserId)
    if (currentUserIndex > -1) {
      const [currentUser] = rankings.splice(currentUserIndex, 1)
      rankings.unshift(currentUser)
    }
    return rankings
  }
}
function calculatePlaceholders(userStats, rankings, userId, params) {
  const winsUser = userStats.wins || 0
  let winsRank
  if (params.rankMode === 2) {
    const points = userStats.points || 0
    const betterScores = rankings.filter((rank) => rank.points > points).length
    winsRank = betterScores + 1
  } else {
    const currentUserIndex = rankings.findIndex((rank) => rank.userId === userId)
    winsRank = currentUserIndex + 1 || '不明'
  }
  const winsRate = userStats.draws > 0 ? (winsUser / userStats.draws) * 100 : 0
  return {
    winsUser,
    winsRank,
    winsRate,
  }
}
