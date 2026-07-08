export type Suit = 'spade' | 'heart' | 'diamond' | 'club'

export type Rank = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2' | 'small' | 'big'

export interface Card {
  id: number
  suit: Suit | 'joker'
  rank: Rank
  value: number
}

export type CombinationType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'triple_pair'
  | 'straight'
  | 'consecutive_pairs'
  | 'airplane'
  | 'bomb'
  | 'rocket'

export interface Combination {
  type: CombinationType
  mainValue: number
  length: number
  cards: Card[]
}

export type Phase = 'dealing' | 'bidding' | 'playing' | 'roundEnd'

export interface Player {
  id: number
  name: string
  hand: Card[]
  isHuman: boolean
  isLandlord: boolean
  bid: number
}

export interface PlayRecord {
  playerId: number
  cards: Card[]
  combination: Combination | null
  passed: boolean
}

export interface GameState {
  phase: Phase
  players: Player[]
  deck: Card[]
  bottomCards: Card[]
  currentPlayerIndex: number
  landlordIndex: number
  biddingState: BiddingState
  playingState: PlayingState
  roundNumber: number
  scores: number[]
  multiplier: number
  aiDifficulty: AIDifficulty
}

export interface BiddingState {
  currentBidderIndex: number
  highestBid: number
  highestBidderIndex: number
  bids: number[]
  passCount: number
}

export interface PlayingState {
  lastPlay: Combination | null
  lastPlayerIndex: number
  consecutivePasses: number
  playHistory: PlayRecord[]
}

export type AIDifficulty = 'easy' | 'medium' | 'hard'
