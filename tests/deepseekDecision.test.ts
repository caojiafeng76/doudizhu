import { describe, expect, test } from 'bun:test'
import type { Card, GameState } from '../src/game/types.ts'
import { createPlayCandidates, pickDeepSeekPlay, requestAIDecision } from '../src/game/deepseekAI.ts'

function card(id: number, rank: Card['rank'], value: number): Card {
  return { id, suit: 'spade', rank, value }
}

const hand = [
  card(1, '3', 3),
  card(2, '4', 4),
  card(3, '5', 5),
  card(4, '6', 6),
  card(5, '7', 7),
]

const baseState = {
  phase: 'playing',
  players: [
    { id: 0, name: '你', hand: [], isHuman: true, isLandlord: false, bid: 0 },
    { id: 1, name: '电脑A', hand, isHuman: false, isLandlord: true, bid: 1 },
    { id: 2, name: '电脑B', hand: [], isHuman: false, isLandlord: false, bid: 0 },
    { id: 3, name: '电脑C', hand: [], isHuman: false, isLandlord: false, bid: 0 },
  ],
  deck: [],
  bottomCards: [],
  currentPlayerIndex: 1,
  landlordIndex: 1,
  biddingState: { currentBidderIndex: 1, highestBid: 1, highestBidderIndex: 1, bids: [0, 1, 0, 0], passCount: 0 },
  playingState: { lastPlay: null, lastPlayerIndex: -1, consecutivePasses: 0, playHistory: [] },
  roundNumber: 1,
  scores: [0, 0, 0, 0],
  multiplier: 1,
  aiDifficulty: 'medium',
} satisfies GameState

describe('DeepSeek AI decision helpers', () => {
  test('builds stable legal play candidate ids from the current hand', () => {
    const candidates = createPlayCandidates(hand, null)

    expect(candidates.map(candidate => candidate.id)).toEqual([
      'play-1',
      'play-2',
      'play-3',
      'play-4',
      'play-5',
      'play-1-2-3-4-5',
    ])
    expect(candidates[0].cards).toEqual([hand[0]])
  })

  test('only accepts a DeepSeek play that references a legal candidate', () => {
    const candidates = createPlayCandidates(hand, null)

    expect(pickDeepSeekPlay({ action: 'play', candidateId: 'play-2' }, candidates)).toEqual([hand[1]])
    expect(pickDeepSeekPlay({ action: 'play', candidateId: 'made-up' }, candidates)).toBeNull()
    expect(pickDeepSeekPlay({ action: 'pass' }, candidates)).toBeNull()
  })

  test('falls back when the local proxy cannot provide a valid play', async () => {
    const fallback = [hand[0]]
    const fetcher = async () => new Response(JSON.stringify({ action: 'play', candidateId: 'made-up' }))

    const decision = await requestAIDecision({
      state: baseState,
      playerId: 1,
      mode: 'play',
      candidates: createPlayCandidates(hand, null),
      fallback,
      fetcher,
    })

    expect(decision.action).toBe('play')
    expect(decision.cards).toEqual(fallback)
    expect(decision.source).toBe('fallback')
  })

  test('accepts a valid DeepSeek bid', async () => {
    const fetcher = async () => new Response(JSON.stringify({ action: 'bid', bid: 2 }))

    const decision = await requestAIDecision({
      state: baseState,
      playerId: 1,
      mode: 'bid',
      fallbackBid: 0,
      fetcher,
    })

    expect(decision).toEqual({ action: 'bid', bid: 2, source: 'deepseek' })
  })
})
