import { describe, expect, test } from 'bun:test'
import { aiPlayTurn } from '../src/game/ai.ts'
import type { Card, Combination } from '../src/game/types.ts'

function card(id: number, rank: Card['rank'], value: number, suit: Card['suit'] = 'spade'): Card {
  return { id, rank, value, suit }
}

describe('local AI play strategy', () => {
  test('uses the lowest ordinary single before spending a 2 or bomb', () => {
    const hand = [
      card(1, '2', 15),
      card(2, '9', 9),
      card(3, '9', 9, 'heart'),
      card(4, '9', 9, 'diamond'),
      card(5, '9', 9, 'club'),
      card(6, '7', 7),
    ]
    const lastPlay: Combination = {
      type: 'single',
      mainValue: 6,
      length: 1,
      cards: [card(99, '6', 6)],
    }

    expect(aiPlayTurn(hand, lastPlay, false, 'medium')).toEqual([hand[5]])
  })

  test('hard difficulty takes an immediate winning play when available', () => {
    const hand = [
      card(1, '8', 8),
      card(2, '8', 8, 'heart'),
      card(3, '8', 8, 'diamond'),
      card(4, '8', 8, 'club'),
      card(5, '8', 8),
      card(6, '8', 8, 'heart'),
    ]
    const lastPlay: Combination = {
      type: 'single',
      mainValue: 2,
      length: 1,
      cards: [card(99, '3', 3)],
    }

    expect(aiPlayTurn(hand, lastPlay, false, 'hard')).toEqual(hand)
  })
})
