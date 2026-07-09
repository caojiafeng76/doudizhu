import type { Card, GameState, Player, BiddingState, PlayingState, AIDifficulty } from './types'
import { createDeck, dealCards } from './deck'
import { identifyCombination, canBeat } from './cardLogic'

const PLAYER_NAMES = ['你', '电脑A', '电脑B', '电脑C']

function nextPlayerIndex(currentIndex: number): number {
  return (currentIndex + 3) % 4
}

export function createInitialState(aiDifficulty: AIDifficulty = 'medium'): GameState {
  const deck = createDeck()
  const { hands, bottomCards } = dealCards(deck)

  const players: Player[] = hands.map((hand, i) => ({
    id: i,
    name: PLAYER_NAMES[i],
    hand,
    isHuman: i === 0,
    isLandlord: false,
    bid: 0,
  }))

  const biddingState: BiddingState = {
    currentBidderIndex: 0,
    highestBid: 0,
    highestBidderIndex: -1,
    bids: [0, 0, 0, 0],
    passCount: 0,
  }

  const playingState: PlayingState = {
    lastPlay: null,
    lastPlayerIndex: -1,
    consecutivePasses: 0,
    playHistory: [],
  }

  return {
    phase: 'bidding',
    players,
    deck,
    bottomCards,
    currentPlayerIndex: 0,
    landlordIndex: -1,
    biddingState,
    playingState,
    roundNumber: 1,
    scores: [0, 0, 0, 0],
    multiplier: 1,
    aiDifficulty,
  }
}

export function placeBid(state: GameState, playerId: number, bid: number): GameState {
  if (state.phase !== 'bidding') return state

  const newState = { ...state }
  const bidding = { ...state.biddingState }
  bidding.bids[playerId] = bid

  if (bid === 0) {
    bidding.passCount++
  } else if (bid > bidding.highestBid) {
    bidding.highestBid = bid
    bidding.highestBidderIndex = playerId
  }

  const nextBidder = nextPlayerIndex(state.biddingState.currentBidderIndex)

  if (bidding.passCount === 3 && bidding.highestBidderIndex !== -1) {
    return assignLandlord(newState, bidding.highestBidderIndex)
  }

  if (nextBidder === 0 && bidding.highestBid > 0) {
    return assignLandlord(newState, bidding.highestBidderIndex)
  }

  if (bidding.passCount >= 4) {
    const newDeck = createDeck()
    const { hands, bottomCards } = dealCards(newDeck)
    newState.deck = newDeck
    newState.bottomCards = bottomCards
    newState.players = state.players.map((p, i) => ({ ...p, hand: hands[i], isLandlord: false, bid: 0 }))
    newState.biddingState = {
      currentBidderIndex: 0,
      highestBid: 0,
      highestBidderIndex: -1,
      bids: [0, 0, 0, 0],
      passCount: 0,
    }
    newState.currentPlayerIndex = 0
    return newState
  }

  bidding.currentBidderIndex = nextBidder
  newState.biddingState = bidding
  newState.currentPlayerIndex = nextBidder

  return newState
}

function assignLandlord(state: GameState, landlordIndex: number): GameState {
  const newState = { ...state, phase: 'playing' as const, landlordIndex }
  newState.players = state.players.map((p, i) => ({
    ...p,
    isLandlord: i === landlordIndex,
    hand: i === landlordIndex ? [...p.hand, ...state.bottomCards].sort((a, b) => b.value - a.value) : p.hand,
  }))
  newState.currentPlayerIndex = landlordIndex
  newState.playingState = { ...state.playingState, lastPlayerIndex: landlordIndex }
  return newState
}

export function playCards(state: GameState, playerId: number, cards: Card[]): GameState {
  if (state.phase !== 'playing') return state
  if (playerId !== state.currentPlayerIndex) return state

  const combination = identifyCombination(cards)
  if (!combination) return state

  if (state.playingState.lastPlay && state.playingState.lastPlayerIndex !== playerId) {
    if (!canBeat(combination, state.playingState.lastPlay)) return state
  }

  const newState = { ...state }
  newState.players = state.players.map(p => {
    if (p.id !== playerId) return p
    const newHand = p.hand.filter(c => !cards.some(played => played.id === c.id))
    return { ...p, hand: newHand }
  })

  const record = { playerId, cards, combination, passed: false }
  newState.playingState = {
    lastPlay: combination,
    lastPlayerIndex: playerId,
    consecutivePasses: 0,
    playHistory: [...state.playingState.playHistory, record],
  }

  if (combination.type === 'bomb' || combination.type === 'rocket') {
    newState.multiplier = state.multiplier * 2
  }

  const player = newState.players[playerId]
  if (player.hand.length === 0) {
    return finishRound(newState, playerId)
  }

  newState.currentPlayerIndex = nextPlayerIndex(state.currentPlayerIndex)
  return newState
}

export function passTurn(state: GameState, playerId: number): GameState {
  if (state.phase !== 'playing') return state
  if (playerId !== state.currentPlayerIndex) return state
  if (state.playingState.lastPlayerIndex === playerId) return state

  const newState = { ...state }
  const record = { playerId, cards: [] as Card[], combination: null, passed: true }
  const newConsecutivePasses = state.playingState.consecutivePasses + 1

  newState.playingState = {
    ...state.playingState,
    consecutivePasses: newConsecutivePasses,
    playHistory: [...state.playingState.playHistory, record],
  }

  if (newConsecutivePasses >= 3) {
    newState.playingState = {
      ...newState.playingState,
      lastPlay: null,
      lastPlayerIndex: -1,
      consecutivePasses: 0,
    }
  }

  newState.currentPlayerIndex = nextPlayerIndex(state.currentPlayerIndex)
  return newState
}

function finishRound(state: GameState, winnerId: number): GameState {
  const winner = state.players[winnerId]
  const isLandlordWin = winner.isLandlord
  let multiplier = state.multiplier

  const landlord = state.players.find(p => p.isLandlord)!
  const farmers = state.players.filter(p => !p.isLandlord)

  const landlordPlays = state.playingState.playHistory.filter(r => r.playerId === landlord.id && !r.passed)
  const farmerPlays = state.playingState.playHistory.filter(r => !state.players[r.playerId].isLandlord && !r.passed)

  if (isLandlordWin && farmerPlays.length === 0) {
    multiplier *= 2
  } else if (!isLandlordWin && landlordPlays.length <= 1) {
    multiplier *= 2
  }

  const baseScore = multiplier
  const newScores = [...state.scores]

  if (isLandlordWin) {
    newScores[landlord.id] += baseScore * 3
    for (const farmer of farmers) {
      newScores[farmer.id] -= baseScore
    }
  } else {
    newScores[landlord.id] -= baseScore * 3
    for (const farmer of farmers) {
      newScores[farmer.id] += baseScore
    }
  }

  return {
    ...state,
    phase: 'roundEnd',
    scores: newScores,
  }
}

export function startNewRound(state: GameState): GameState {
  const deck = createDeck()
  const { hands, bottomCards } = dealCards(deck)

  const players: Player[] = hands.map((hand, i) => ({
    id: i,
    name: PLAYER_NAMES[i],
    hand,
    isHuman: i === 0,
    isLandlord: false,
    bid: 0,
  }))

  const biddingState: BiddingState = {
    currentBidderIndex: 0,
    highestBid: 0,
    highestBidderIndex: -1,
    bids: [0, 0, 0, 0],
    passCount: 0,
  }

  const playingState: PlayingState = {
    lastPlay: null,
    lastPlayerIndex: -1,
    consecutivePasses: 0,
    playHistory: [],
  }

  return {
    ...state,
    phase: 'bidding',
    players,
    deck,
    bottomCards,
    currentPlayerIndex: 0,
    landlordIndex: -1,
    biddingState,
    playingState,
    roundNumber: state.roundNumber + 1,
    multiplier: 1,
  }
}
