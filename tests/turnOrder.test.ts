import { describe, expect, test } from 'bun:test'
import type { Card, GameState, Player } from '../src/game/types.ts'
import { passTurn, placeBid, playCards } from '../src/game/gameEngine.ts'

function card(id: number, rank: Card['rank'], value: number): Card {
  return { id, rank, value, suit: 'spade' }
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
      player(0, [card(1, '3', 3), card(2, '4', 4)]),
      player(1, [card(3, '5', 5)]),
      player(2, [card(4, '6', 6)]),
      player(3, [card(5, '7', 7)]),
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

describe('turn order', () => {
  test('bidding advances anticlockwise from the human to the right player', () => {
    const state = { ...baseState(), phase: 'bidding' as const }
    const next = placeBid(state, 0, 0)

    expect(next.currentPlayerIndex).toBe(3)
    expect(next.biddingState.currentBidderIndex).toBe(3)
  })

  test('playing advances anticlockwise after a valid play', () => {
    const state = baseState()
    const next = playCards(state, 0, [state.players[0].hand[0]])

    expect(next.currentPlayerIndex).toBe(3)
  })

  test('passing advances anticlockwise', () => {
    const state = baseState()
    state.currentPlayerIndex = 3
    state.playingState.lastPlay = {
      type: 'single',
      mainValue: 3,
      length: 1,
      cards: [state.players[0].hand[0]],
    }
    state.playingState.lastPlayerIndex = 0

    const next = passTurn(state, 3)

    expect(next.currentPlayerIndex).toBe(2)
  })
})
