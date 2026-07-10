import { describe, expect, test } from 'bun:test'
import type { Card } from '../src/game/types.ts'
import { createPlayCandidates } from '../src/game/deepseekAI.ts'

function card(id: number, rank: Card['rank'], value: number): Card {
  return { id, rank, value, suit: 'spade' }
}

describe('AI play candidate ordering', () => {
  test('offers low ordinary opening plays before high singles and bombs', () => {
    const hand = [
      card(1, '2', 15),
      card(2, 'A', 14),
      card(3, 'K', 13),
      card(4, '9', 9),
      card(5, '9', 9),
      card(6, '9', 9),
      card(7, '9', 9),
      card(8, '3', 3),
      card(9, '4', 4),
      card(10, '5', 5),
      card(11, '6', 6),
      card(12, '7', 7),
    ]

    const candidates = createPlayCandidates(hand, null)

    expect(candidates[0].combination.type).not.toBe('bomb')
    expect(candidates[0].combination.type).not.toBe('rocket')
    expect(candidates[0].combination.mainValue).toBeLessThan(15)
    expect(candidates.at(-1)?.combination.type).toBe('bomb')
  })

  test('puts bombs after ordinary beating plays when responding', () => {
    const hand = [
      card(1, '2', 15),
      card(2, '9', 9),
      card(3, '9', 9),
      card(4, '9', 9),
      card(5, '9', 9),
      card(6, '7', 7),
    ]
    const lastPlay = {
      type: 'single' as const,
      mainValue: 6,
      length: 1,
      cards: [card(99, '6', 6)],
    }

    const candidates = createPlayCandidates(hand, lastPlay)

    expect(candidates[0].combination.type).toBe('single')
    expect(candidates[0].combination.mainValue).toBe(7)
    expect(candidates.at(-1)?.combination.type).toBe('bomb')
  })

  test('does not offer partial plays from a four-card bomb', () => {
    const hand = [
      card(1, 'Q', 12),
      card(2, 'K', 13),
      card(3, 'K', 13),
      card(4, 'K', 13),
      card(5, 'K', 13),
      card(6, 'A', 14),
    ]
    const lastPlay = {
      type: 'single' as const,
      mainValue: 12,
      length: 1,
      cards: [card(99, 'Q', 12)],
    }

    const candidates = createPlayCandidates(hand, lastPlay)
    const kingCandidates = candidates.filter((candidate) =>
      candidate.cards.some((card) => card.value === 13),
    )

    expect(kingCandidates).toHaveLength(1)
    expect(kingCandidates[0].combination.type).toBe('bomb')
  })
})
