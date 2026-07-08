import type { Card, Rank, Suit } from './types'

const SUITS: Suit[] = ['spade', 'heart', 'diamond', 'club']
const RANKS: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']

const RANK_VALUES: Record<Rank, number> = {
  '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, '2': 15,
  'small': 16, 'big': 17,
}

export function createDeck(): Card[] {
  const cards: Card[] = []
  let id = 0

  for (let deck = 0; deck < 2; deck++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: id++, suit, rank, value: RANK_VALUES[rank] })
      }
    }
    cards.push({ id: id++, suit: 'joker', rank: 'small', value: RANK_VALUES['small'] })
    cards.push({ id: id++, suit: 'joker', rank: 'big', value: RANK_VALUES['big'] })
  }

  return cards
}

export function shuffle<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function dealCards(deck: Card[]): { hands: Card[][]; bottomCards: Card[] } {
  const shuffled = shuffle(deck)
  const hands: Card[][] = [[], [], [], []]

  for (let i = 0; i < 100; i++) {
    hands[i % 4].push(shuffled[i])
  }

  const bottomCards = shuffled.slice(100, 108)

  for (const hand of hands) {
    hand.sort((a, b) => b.value - a.value || a.suit.localeCompare(b.suit))
  }

  return { hands, bottomCards }
}

export function getCardDisplay(card: Card): { suit: string; rank: string; color: string } {
  const suitSymbols: Record<string, string> = {
    spade: '♠', heart: '♥', diamond: '♦', club: '♣', joker: '🃏',
  }
  const rankDisplay: Record<string, string> = {
    'small': '小', 'big': '大',
  }
  const isRed = card.suit === 'heart' || card.suit === 'diamond' || card.rank === 'big'
  const isBlack = card.suit === 'spade' || card.suit === 'club' || card.rank === 'small'

  return {
    suit: suitSymbols[card.suit],
    rank: rankDisplay[card.rank] || card.rank,
    color: isRed ? '#d32f2f' : isBlack ? '#212121' : '#d32f2f',
  }
}
