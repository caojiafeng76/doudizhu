import type { Card, Combination, GameState } from './types.ts'
import { findValidPlays, identifyCombination } from './cardLogic.ts'
import { comparePlayCandidateStrength } from './aiStrategy.ts'

type DecisionSource = 'deepseek' | 'fallback'

export interface PlayCandidate {
  id: string
  cards: Card[]
  combination: {
    type: Combination['type']
    mainValue: number
    length: number
    cardCount: number
  }
  labels: string[]
}

type DeepSeekDecisionResponse = {
  action?: unknown
  bid?: unknown
  candidateId?: unknown
  tableTalk?: unknown
}

type DecisionFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

type BidDecisionOptions = {
  state: GameState
  playerId: number
  mode: 'bid'
  fallbackBid: number
  fetcher?: DecisionFetch
}

type PlayDecisionOptions = {
  state: GameState
  playerId: number
  mode: 'play'
  candidates: PlayCandidate[]
  fallback: Card[] | null
  fetcher?: DecisionFetch
}

export type AIDecision =
  | { action: 'bid'; bid: number; source: DecisionSource }
  | { action: 'play'; cards: Card[]; source: DecisionSource }
  | { action: 'pass'; source: DecisionSource }

export function createPlayCandidates(hand: Card[], lastPlay: Combination | null): PlayCandidate[] {
  return findValidPlays(hand, lastPlay)
    .map(cards => {
      const combination = identifyCombination(cards)
      if (!combination) return null

      return {
        id: `play-${cards.map(card => card.id).sort((a, b) => a - b).join('-')}`,
        cards,
        combination: {
          type: combination.type,
          mainValue: combination.mainValue,
          length: combination.length,
          cardCount: cards.length,
        },
        labels: cards.map(formatCard),
      }
    })
    .filter((candidate): candidate is PlayCandidate => candidate !== null)
    .sort(comparePlayCandidates)
}

export function pickDeepSeekPlay(
  response: DeepSeekDecisionResponse,
  candidates: PlayCandidate[]
): Card[] | null {
  if (response.action !== 'play' || typeof response.candidateId !== 'string') {
    return null
  }

  return candidates.find(candidate => candidate.id === response.candidateId)?.cards ?? null
}

export async function requestAIDecision(options: BidDecisionOptions | PlayDecisionOptions): Promise<AIDecision> {
  const fallback = createFallbackDecision(options)

  try {
    const fetcher = options.fetcher ?? fetch
    const response = await fetcher('/api/deepseek/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createDecisionPayload(options)),
    })

    if (!response.ok) return fallback

    const data = await response.json() as DeepSeekDecisionResponse
    return validateDeepSeekDecision(data, options) ?? fallback
  } catch {
    return fallback
  }
}

function createFallbackDecision(options: BidDecisionOptions | PlayDecisionOptions): AIDecision {
  if (options.mode === 'bid') {
    return { action: 'bid', bid: options.fallbackBid, source: 'fallback' }
  }

  if (options.fallback) {
    return { action: 'play', cards: options.fallback, source: 'fallback' }
  }

  return { action: 'pass', source: 'fallback' }
}

function validateDeepSeekDecision(
  data: DeepSeekDecisionResponse,
  options: BidDecisionOptions | PlayDecisionOptions
): AIDecision | null {
  if (options.mode === 'bid') {
    if (data.action !== 'bid' || typeof data.bid !== 'number') return null
    const bid = Math.trunc(data.bid)
    const currentBid = options.state.biddingState.highestBid
    if (bid === 0) return { action: 'bid', bid, source: 'deepseek' }
    if (bid > currentBid && bid >= 1 && bid <= 3) return { action: 'bid', bid, source: 'deepseek' }
    return null
  }

  if (data.action === 'pass' && canPlayerPass(options.state, options.playerId)) {
    return { action: 'pass', source: 'deepseek' }
  }

  const cards = pickDeepSeekPlay(data, options.candidates)
  return cards ? { action: 'play', cards, source: 'deepseek' } : null
}

function canPlayerPass(state: GameState, playerId: number): boolean {
  return Boolean(state.playingState.lastPlay) && state.playingState.lastPlayerIndex !== playerId
}

function comparePlayCandidates(a: PlayCandidate, b: PlayCandidate): number {
  return comparePlayCandidateStrength(a, b)
}

function createDecisionPayload(options: BidDecisionOptions | PlayDecisionOptions) {
  const player = options.state.players[options.playerId]
  const recentHistory = options.state.playingState.playHistory.slice(-8).map(record => ({
    playerId: record.playerId,
    playerName: options.state.players[record.playerId]?.name ?? `玩家${record.playerId}`,
    passed: record.passed,
    cards: record.cards.map(formatCard),
    combination: record.combination ? summarizeCombination(record.combination) : null,
  }))

  return {
    mode: options.mode,
    playerId: options.playerId,
    playerName: player.name,
    personality: getPlayerPersonality(options.playerId),
    phase: options.state.phase,
    difficulty: options.state.aiDifficulty,
    currentHighestBid: options.state.biddingState.highestBid,
    landlordIndex: options.state.landlordIndex,
    landlordName: options.state.players[options.state.landlordIndex]?.name ?? null,
    isLandlord: player.isLandlord,
    multiplier: options.state.multiplier,
    hand: player.hand.map(formatCard),
    remainingCards: options.state.players.map(otherPlayer => ({
      playerId: otherPlayer.id,
      name: otherPlayer.name,
      count: otherPlayer.hand.length,
      isLandlord: otherPlayer.isLandlord,
    })),
    lastPlay: options.state.playingState.lastPlay ? summarizeCombination(options.state.playingState.lastPlay) : null,
    lastPlayerIndex: options.state.playingState.lastPlayerIndex,
    recentHistory,
    candidates: options.mode === 'play'
      ? options.candidates.map(candidate => ({
        id: candidate.id,
        combination: candidate.combination,
        labels: candidate.labels,
      }))
      : undefined,
    legalBids: options.mode === 'bid' ? legalBids(options.state.biddingState.highestBid) : undefined,
  }
}

function summarizeCombination(combination: Combination) {
  return {
    type: combination.type,
    mainValue: combination.mainValue,
    length: combination.length,
    cardCount: combination.cards.length,
    labels: combination.cards.map(formatCard),
  }
}

function legalBids(currentHighestBid: number): number[] {
  return [0, 1, 2, 3].filter(bid => bid === 0 || bid > currentHighestBid)
}

function getPlayerPersonality(playerId: number): string {
  if (playerId === 1) return '保守稳健，少拆好牌，优先留对子和炸弹到关键时刻'
  if (playerId === 2) return '均衡理性，重视牌效和队友配合'
  if (playerId === 3) return '偏激进，愿意主动压制和抢节奏，但不能乱出非法牌'
  return '会赢但自然'
}

function formatCard(card: Card): string {
  if (card.suit === 'joker') {
    return card.rank === 'big' ? '大王' : '小王'
  }
  return card.rank
}
