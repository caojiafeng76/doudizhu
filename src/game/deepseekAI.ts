import type { Card, Combination, GameState } from './types.ts'
import { findValidPlays, identifyCombination } from './cardLogic.ts'
import {
  comparePlayCandidateStrength,
  filterPlaysPreservingBombs,
} from './aiStrategy.ts'

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

export interface AIAnalysis {
  why: string
  opponent: string
  factors: string[]
}

export type AIAnalysisResult = {
  status: 'ready' | 'unavailable'
  action: 'play' | 'pass'
  candidate: PlayCandidate | null
  analysis: AIAnalysis | null
  source: DecisionSource
  message?: string
}

type DeepSeekDecisionResponse = {
  action?: unknown
  bid?: unknown
  candidateId?: unknown
  tableTalk?: unknown
  analysis?: unknown
}

export type DecisionFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

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

export type AnalysisDecisionOptions = {
  state: GameState
  playerId: number
  mode: 'analysis'
  candidates: PlayCandidate[]
  fallback: Card[] | null
  fetcher?: DecisionFetch
}

export type AIDecision =
  | {
      action: 'bid'
      bid: number
      source: DecisionSource
      analysis?: AIAnalysis
    }
  | {
      action: 'play'
      cards: Card[]
      source: DecisionSource
      analysis?: AIAnalysis
    }
  | { action: 'pass'; source: DecisionSource; analysis?: AIAnalysis }

export function createPlayCandidates(
  hand: Card[],
  lastPlay: Combination | null,
): PlayCandidate[] {
  return filterPlaysPreservingBombs(hand, findValidPlays(hand, lastPlay))
    .map((cards) => {
      const combination = identifyCombination(cards)
      if (!combination) return null

      return {
        id: `play-${cards
          .map((card) => card.id)
          .sort((a, b) => a - b)
          .join('-')}`,
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
  candidates: PlayCandidate[],
): Card[] | null {
  if (response.action !== 'play' || typeof response.candidateId !== 'string') {
    return null
  }

  return (
    candidates.find((candidate) => candidate.id === response.candidateId)
      ?.cards ?? null
  )
}

function parseAIAnalysis(value: unknown): AIAnalysis | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (
    typeof record.why !== 'string' ||
    typeof record.opponent !== 'string' ||
    !Array.isArray(record.factors)
  ) {
    return null
  }

  const why = record.why.trim().slice(0, 120)
  const opponent = record.opponent.trim().slice(0, 120)
  const factors = record.factors
    .filter((factor): factor is string => typeof factor === 'string')
    .map((factor) => factor.trim().slice(0, 24))
    .filter(Boolean)
    .slice(0, 3)

  if (!why || !opponent) return null
  return { why, opponent, factors }
}

function findCandidateForCards(
  cards: Card[] | null,
  candidates: PlayCandidate[],
): PlayCandidate | null {
  if (!cards) return null
  const candidateId = `play-${cards
    .map((card) => card.id)
    .sort((a, b) => a - b)
    .join('-')}`
  return candidates.find((candidate) => candidate.id === candidateId) ?? null
}

function unavailableAnalysisResult(
  fallback: Card[] | null,
  candidates: PlayCandidate[],
  message = '分析暂不可用，你可以按自己的判断出牌',
): AIAnalysisResult {
  const candidate = findCandidateForCards(fallback, candidates)
  return {
    status: 'unavailable',
    action: candidate ? 'play' : 'pass',
    candidate,
    analysis: null,
    source: 'fallback',
    message,
  }
}

export async function requestAIDecision(
  options: BidDecisionOptions | PlayDecisionOptions,
): Promise<AIDecision> {
  const fallback = createFallbackDecision(options)

  try {
    const fetcher = options.fetcher ?? fetch
    const response = await fetcher('/api/deepseek/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createDecisionPayload(options)),
    })

    if (!response.ok) return fallback

    const data = (await response.json()) as DeepSeekDecisionResponse
    return validateDeepSeekDecision(data, options) ?? fallback
  } catch {
    return fallback
  }
}

function validateAIAnalysis(
  data: DeepSeekDecisionResponse,
  options: AnalysisDecisionOptions,
): AIAnalysisResult | null {
  const analysis = parseAIAnalysis(data.analysis)

  if (
    data.action === 'pass' &&
    canPlayerPass(options.state, options.playerId)
  ) {
    return {
      status: 'ready',
      action: 'pass',
      candidate: null,
      analysis,
      source: 'deepseek',
    }
  }

  if (data.action !== 'play' || typeof data.candidateId !== 'string')
    return null
  const candidate = options.candidates.find(
    (item) => item.id === data.candidateId,
  )
  if (!candidate) return null

  return {
    status: 'ready',
    action: 'play',
    candidate,
    analysis,
    source: 'deepseek',
  }
}

export async function requestAIAnalysis(
  options: AnalysisDecisionOptions,
): Promise<AIAnalysisResult> {
  const fallback = () =>
    unavailableAnalysisResult(options.fallback, options.candidates)

  try {
    const fetcher = options.fetcher ?? fetch
    const response = await fetcher('/api/deepseek/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createDecisionPayload(options)),
    })

    if (!response.ok) return fallback()

    const data = (await response.json()) as DeepSeekDecisionResponse
    return validateAIAnalysis(data, options) ?? fallback()
  } catch {
    return fallback()
  }
}

function createFallbackDecision(
  options: BidDecisionOptions | PlayDecisionOptions,
): AIDecision {
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
  options: BidDecisionOptions | PlayDecisionOptions,
): AIDecision | null {
  const analysis = parseAIAnalysis(data.analysis)

  if (options.mode === 'bid') {
    if (data.action !== 'bid' || typeof data.bid !== 'number') return null
    const bid = Math.trunc(data.bid)
    const currentBid = options.state.biddingState.highestBid
    if (bid === 0)
      return withAnalysis({ action: 'bid', bid, source: 'deepseek' }, analysis)
    if (bid > currentBid && bid >= 1 && bid <= 3) {
      return withAnalysis({ action: 'bid', bid, source: 'deepseek' }, analysis)
    }
    return null
  }

  if (
    data.action === 'pass' &&
    canPlayerPass(options.state, options.playerId)
  ) {
    return withAnalysis({ action: 'pass', source: 'deepseek' }, analysis)
  }

  const cards = pickDeepSeekPlay(data, options.candidates)
  return cards
    ? withAnalysis({ action: 'play', cards, source: 'deepseek' }, analysis)
    : null
}

function withAnalysis(
  decision: AIDecision,
  analysis: AIAnalysis | null,
): AIDecision {
  return analysis ? { ...decision, analysis } : decision
}

function canPlayerPass(state: GameState, playerId: number): boolean {
  return (
    Boolean(state.playingState.lastPlay) &&
    state.playingState.lastPlayerIndex !== playerId
  )
}

function comparePlayCandidates(a: PlayCandidate, b: PlayCandidate): number {
  return comparePlayCandidateStrength(a, b)
}

function createDecisionPayload(
  options: BidDecisionOptions | PlayDecisionOptions | AnalysisDecisionOptions,
) {
  const player = options.state.players[options.playerId]
  const recentHistory = options.state.playingState.playHistory
    .slice(-8)
    .map((record) => ({
      playerId: record.playerId,
      playerName:
        options.state.players[record.playerId]?.name ??
        `玩家${record.playerId}`,
      passed: record.passed,
      cards: record.cards.map(formatCard),
      combination: record.combination
        ? summarizeCombination(record.combination)
        : null,
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
    landlordName:
      options.state.players[options.state.landlordIndex]?.name ?? null,
    isLandlord: player.isLandlord,
    multiplier: options.state.multiplier,
    hand: player.hand.map(formatCard),
    remainingCards: options.state.players.map((otherPlayer) => ({
      playerId: otherPlayer.id,
      name: otherPlayer.name,
      count: otherPlayer.hand.length,
      isLandlord: otherPlayer.isLandlord,
    })),
    lastPlay: options.state.playingState.lastPlay
      ? summarizeCombination(options.state.playingState.lastPlay)
      : null,
    lastPlayerIndex: options.state.playingState.lastPlayerIndex,
    recentHistory,
    candidates:
      options.mode === 'play' || options.mode === 'analysis'
        ? options.candidates.map((candidate) => ({
            id: candidate.id,
            combination: candidate.combination,
            labels: candidate.labels,
          }))
        : undefined,
    legalBids:
      options.mode === 'bid'
        ? legalBids(options.state.biddingState.highestBid)
        : undefined,
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
  return [0, 1, 2, 3].filter((bid) => bid === 0 || bid > currentHighestBid)
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
