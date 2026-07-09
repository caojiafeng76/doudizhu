import { describe, expect, test } from 'bun:test'
import { findValidPlays, identifyCombination } from '../src/game/cardLogic.ts'
import { passTurn, placeBid, playCards } from '../src/game/gameEngine.ts'
import type { Card, GameState, Player } from '../src/game/types.ts'

function card(id: number, rank: Card['rank'], value: number, suit: Card['suit'] = 'spade'): Card {
  return { id, rank, value, suit }
}

function player(id: number, hand: Card[]): Player {
  return {
    id,
    name: `玩家${id}`,
    hand,
    isHuman: id === 0,
    isLandlord: id === 0,
    bid: 0,
  }
}

function baseState(): GameState {
  return {
    phase: 'playing',
    players: [
      player(0, [card(1, '3', 3), card(2, '3', 3), card(3, '3', 3), card(4, '3', 3)]),
      player(1, [card(5, '5', 5)]),
      player(2, [card(6, '6', 6)]),
      player(3, [card(7, '7', 7)]),
    ],
    deck: [],
    bottomCards: [],
    currentPlayerIndex: 0,
    landlordIndex: 0,
    biddingState: {
      currentBidderIndex: 0,
      highestBid: 0,
      highestBidderIndex: -1,
      bids: [0, 0, 0, 0],
      passCount: 0,
    },
    playingState: {
      lastPlay: null,
      lastPlayerIndex: -1,
      consecutivePasses: 0,
      playHistory: [],
    },
    roundNumber: 1,
    scores: [0, 0, 0, 0],
    multiplier: 1,
    aiDifficulty: 'medium',
  }
}

describe('card rules', () => {
  test('generates each legal bomb length from an oversized same-value group', () => {
    const hand = [
      card(1, '9', 9),
      card(2, '9', 9, 'heart'),
      card(3, '9', 9, 'diamond'),
      card(4, '9', 9, 'club'),
      card(5, '9', 9),
      card(6, '9', 9, 'heart'),
    ]

    const bombLengths = findValidPlays(hand, null)
      .map(play => identifyCombination(play))
      .filter(combination => combination?.type === 'bomb')
      .map(combination => combination?.length)

    expect(bombLengths).toEqual([4, 5, 6])
  })

  test('allows a longer bomb to beat a shorter higher-value bomb', () => {
    const hand = [
      card(1, '3', 3),
      card(2, '3', 3, 'heart'),
      card(3, '3', 3, 'diamond'),
      card(4, '3', 3, 'club'),
      card(5, '3', 3),
    ]
    const lastPlay = {
      type: 'bomb' as const,
      mainValue: 14,
      length: 4,
      cards: [
        card(10, 'A', 14),
        card(11, 'A', 14, 'heart'),
        card(12, 'A', 14, 'diamond'),
        card(13, 'A', 14, 'club'),
      ],
    }

    const bombLengths = findValidPlays(hand, lastPlay)
      .map(play => identifyCombination(play))
      .filter(combination => combination?.type === 'bomb')
      .map(combination => combination?.length)

    expect(bombLengths).toEqual([5])
  })
})

describe('game engine rule guards', () => {
  test('rejects bids from anyone other than the current bidder', () => {
    const state = { ...baseState(), phase: 'bidding' as const }
    const next = placeBid(state, 1, 3)

    expect(next).toBe(state)
    expect(state.biddingState.bids).toEqual([0, 0, 0, 0])
  })

  test('rejects bids that are not pass or higher than the current highest bid', () => {
    const state = {
      ...baseState(),
      phase: 'bidding' as const,
      biddingState: {
        ...baseState().biddingState,
        highestBid: 2,
        highestBidderIndex: 3,
      },
    }

    expect(placeBid(state, 0, 2)).toBe(state)
    expect(placeBid(state, 0, 4)).toBe(state)
  })

  test('rejects playing cards not owned by the current player', () => {
    const state = baseState()
    const next = playCards(state, 0, [card(99, 'A', 14)])

    expect(next).toBe(state)
    expect(state.players[0].hand).toHaveLength(4)
  })

  test('rejects duplicated card ids in a play', () => {
    const state = baseState()
    const duplicated = state.players[0].hand[0]
    const next = playCards(state, 0, [duplicated, duplicated])

    expect(next).toBe(state)
    expect(state.players[0].hand).toHaveLength(4)
  })

  test('rejects passing when there is no active play to beat', () => {
    const state = baseState()
    const next = passTurn(state, 0)

    expect(next).toBe(state)
    expect(state.playingState.playHistory).toEqual([])
  })
})
