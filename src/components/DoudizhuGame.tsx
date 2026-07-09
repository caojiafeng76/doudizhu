import { useState, useCallback, useEffect, useRef } from 'react'
import type { Card, GameState, AIDifficulty, PlayRecord } from '../game/types'
import { createInitialState, placeBid, playCards, passTurn, startNewRound } from '../game/gameEngine'
import { decideBid, aiPlayTurn } from '../game/ai'
import { createPlayCandidates, requestAIDecision } from '../game/deepseekAI.ts'
import { canBeat, identifyCombination } from '../game/cardLogic.ts'
import { BidPanel } from './BidPanel'
import { Hand } from './Hand'
import { PlayArea } from './PlayArea'
import { PlayerSeat } from './PlayerSeat'
import { GameHeader } from './GameHeader'
import { ScoreBoard } from './ScoreBoard'
import { ResultModal } from './ResultModal'
import { SoundEffects } from '../game/sounds'

const AI_DELAY = 800

export function DoudizhuGame() {
  const [gameState, setGameState] = useState<GameState>(() => createInitialState('medium'))
  const [selectedCardIds, setSelectedCardIds] = useState<number[]>([])
  const [playNotice, setPlayNotice] = useState<string | null>(null)

  const humanPlayer = gameState.players[0]
  const isHumanTurn = gameState.currentPlayerIndex === 0 && gameState.phase === 'playing'
  const isHumanBidding = gameState.currentPlayerIndex === 0 && gameState.phase === 'bidding'

  const soundEnabled = useRef(true)
  const noticeTimerRef = useRef<number | null>(null)

  const showPlayNotice = useCallback((message: string) => {
    setPlayNotice(message)
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current)
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setPlayNotice(null)
      noticeTimerRef.current = null
    }, 1600)
  }, [])

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current)
      }
    }
  }, [])

  const toggleCardSelection = useCallback((cardId: number) => {
    if (soundEnabled.current) {
      setSelectedCardIds(prev => {
        const isSelected = prev.includes(cardId)
        if (isSelected) {
          SoundEffects.deselect()
        } else {
          SoundEffects.select()
        }
        return isSelected ? prev.filter(id => id !== cardId) : [...prev, cardId]
      })
    } else {
      setSelectedCardIds(prev =>
        prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
      )
    }
  }, [])

  const getInvalidPlayMessage = useCallback((cards: Card[]) => {
    if (!isHumanTurn) return '还没轮到你'
    if (cards.length === 0) return '先选牌'

    const combination = identifyCombination(cards)
    if (!combination) return '牌型不符合规则'

    const lastPlay = gameState.playingState.lastPlay
    const mustBeatLastPlay = lastPlay && gameState.playingState.lastPlayerIndex !== 0
    if (mustBeatLastPlay && !canBeat(combination, lastPlay)) {
      return '压不过上家'
    }

    return '不能这样出'
  }, [gameState.playingState.lastPlay, gameState.playingState.lastPlayerIndex, isHumanTurn])

  const attemptPlayCards = useCallback((cardIds: number[]) => {
    if (cardIds.length === 0) {
      showPlayNotice('先选牌')
      if (soundEnabled.current) SoundEffects.invalid()
      return
    }

    const selectedCards = humanPlayer.hand.filter(c => cardIds.includes(c.id))
    const newState = playCards(gameState, 0, selectedCards)
    if (newState !== gameState) {
      if (soundEnabled.current) {
        const comb = newState.playingState.playHistory[newState.playingState.playHistory.length - 1]?.combination
        if (comb?.type === 'bomb' || comb?.type === 'rocket') {
          SoundEffects.bomb()
        } else {
          SoundEffects.playCard()
        }
      }
      setGameState(newState)
      setSelectedCardIds([])
      setPlayNotice(null)
    } else {
      if (soundEnabled.current) SoundEffects.invalid()
      showPlayNotice(getInvalidPlayMessage(selectedCards))
    }
  }, [gameState, getInvalidPlayMessage, humanPlayer.hand, showPlayNotice])

  const handlePlay = useCallback(() => {
    attemptPlayCards(selectedCardIds)
  }, [attemptPlayCards, selectedCardIds])

  const handleCardContextPlay = useCallback((cardId: number) => {
    const cardIds = selectedCardIds.includes(cardId) ? selectedCardIds : [cardId]
    setSelectedCardIds(cardIds)
    attemptPlayCards(cardIds)
  }, [attemptPlayCards, selectedCardIds])

  const handlePass = useCallback(() => {
    if (!isHumanTurn) return
    const newState = passTurn(gameState, 0)
    if (newState !== gameState) {
      if (soundEnabled.current) SoundEffects.pass()
      setGameState(newState)
      setSelectedCardIds([])
    }
  }, [isHumanTurn, gameState])

  const handleBid = useCallback((bid: number) => {
    if (!isHumanBidding) return
    if (soundEnabled.current) SoundEffects.bid()
    const newState = placeBid(gameState, 0, bid)
    setGameState(newState)
  }, [isHumanBidding, gameState])

  const handleNewRound = useCallback(() => {
    if (soundEnabled.current) SoundEffects.shuffle()
    setGameState(prev => startNewRound(prev))
    setSelectedCardIds([])
  }, [])

  const handleDifficultyChange = useCallback((difficulty: AIDifficulty) => {
    setGameState(prev => ({ ...prev, aiDifficulty: difficulty }))
  }, [])

  useEffect(() => {
    if (gameState.phase === 'bidding' && gameState.currentPlayerIndex !== 0) {
      let cancelled = false
      const playerIndex = gameState.currentPlayerIndex
      const timer = setTimeout(() => {
        const aiPlayer = gameState.players[gameState.currentPlayerIndex]
        const fallbackBid = decideBid(aiPlayer.hand, gameState.biddingState.highestBid, gameState.aiDifficulty)

        void requestAIDecision({
          state: gameState,
          playerId: playerIndex,
          mode: 'bid',
          fallbackBid,
        }).then(decision => {
          if (cancelled || decision.action !== 'bid') return
          setGameState(prev => {
            if (prev.phase !== 'bidding' || prev.currentPlayerIndex !== playerIndex) return prev
            return placeBid(prev, playerIndex, decision.bid)
          })
        })
      }, AI_DELAY)
      return () => {
        cancelled = true
        clearTimeout(timer)
      }
    }

    if (gameState.phase === 'playing' && gameState.currentPlayerIndex !== 0) {
      let cancelled = false
      const playerIndex = gameState.currentPlayerIndex
      const timer = setTimeout(() => {
        const aiPlayer = gameState.players[gameState.currentPlayerIndex]
        const fallback = aiPlayTurn(
          aiPlayer.hand,
          gameState.playingState.lastPlay,
          aiPlayer.isLandlord,
          gameState.aiDifficulty
        )
        const candidates = createPlayCandidates(aiPlayer.hand, gameState.playingState.lastPlay)

        void requestAIDecision({
          state: gameState,
          playerId: playerIndex,
          mode: 'play',
          candidates,
          fallback,
        }).then(decision => {
          if (cancelled) return

          if (decision.action === 'play') {
            setGameState(prev => {
              if (prev.phase !== 'playing' || prev.currentPlayerIndex !== playerIndex) return prev
              const next = playCards(prev, playerIndex, decision.cards)
              if (next !== prev && soundEnabled.current) {
                const comb = next.playingState.playHistory[next.playingState.playHistory.length - 1]?.combination
                if (comb?.type === 'bomb' || comb?.type === 'rocket') {
                  SoundEffects.bomb()
                } else {
                  SoundEffects.playCard()
                }
              }
              return next
            })
          } else if (decision.action === 'pass') {
            setGameState(prev => {
              if (prev.phase !== 'playing' || prev.currentPlayerIndex !== playerIndex) return prev
              const next = passTurn(prev, playerIndex)
              if (next !== prev && soundEnabled.current) SoundEffects.pass()
              return next
            })
          }
        })
      }, AI_DELAY)
      return () => {
        cancelled = true
        clearTimeout(timer)
      }
    }
  }, [gameState.phase, gameState.currentPlayerIndex, gameState])

  // Play win/lose sound when round ends
  useEffect(() => {
    if (gameState.phase === 'roundEnd' && soundEnabled.current) {
      const winnerId = gameState.playingState.lastPlayerIndex
      const isHumanWinner = winnerId === 0
      const timer = setTimeout(() => {
        if (isHumanWinner) {
          SoundEffects.win()
        } else {
          SoundEffects.lose()
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [gameState.phase, gameState.playingState.lastPlayerIndex])

  const currentPlayer = gameState.players[gameState.currentPlayerIndex]

  const isAITurn = (playerIndex: number) =>
    (gameState.phase === 'playing' || gameState.phase === 'bidding') &&
    gameState.currentPlayerIndex === playerIndex &&
    playerIndex !== 0

  // Get latest non-consecutive pass play for each player to show in front of them
  const getLastPlayForPlayer = (playerId: number): PlayRecord | null => {
    const history = gameState.playingState.playHistory
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].playerId === playerId) {
        return history[i]
      }
    }
    return null
  }

  return (
    <div className="doudizhu-game">
      <GameHeader
        bottomCards={gameState.bottomCards}
        multiplier={gameState.multiplier}
        currentPlayerName={currentPlayer.name}
        roundNumber={gameState.roundNumber}
        aiDifficulty={gameState.aiDifficulty}
        onDifficultyChange={handleDifficultyChange}
        showBottom={gameState.phase === 'playing' || gameState.phase === 'roundEnd'}
      />

      <div className="table-container">
        {/* Top - 电脑B (index 2) */}
        <PlayerSeat
          player={gameState.players[2]}
          isCurrentTurn={gameState.currentPlayerIndex === 2}
          position="top"
          isThinking={isAITurn(2)}
          lastPlay={gameState.phase === 'playing' ? getLastPlayForPlayer(2) : null}
          humanPlayerId={0}
        />

        {/* Left - 电脑A (index 1) */}
        <PlayerSeat
          player={gameState.players[1]}
          isCurrentTurn={gameState.currentPlayerIndex === 1}
          position="left"
          isThinking={isAITurn(1)}
          lastPlay={gameState.phase === 'playing' ? getLastPlayForPlayer(1) : null}
          humanPlayerId={0}
        />

        {/* Right - 电脑C (index 3) */}
        <PlayerSeat
          player={gameState.players[3]}
          isCurrentTurn={gameState.currentPlayerIndex === 3}
          position="right"
          isThinking={isAITurn(3)}
          lastPlay={gameState.phase === 'playing' ? getLastPlayForPlayer(3) : null}
          humanPlayerId={0}
        />

        {/* Center play area */}
        <PlayArea />

        {/* Bottom - 你 (index 0) - Hand at bottom edge, seat info above it */}
        <Hand
          cards={humanPlayer.hand}
          selectedCardIds={selectedCardIds}
          onCardClick={toggleCardSelection}
          onCardSelectionChange={setSelectedCardIds}
          onCardContextPlay={handleCardContextPlay}
          isHuman={true}
        />

        <div className="human-seat-wrapper">
          <PlayerSeat
            player={gameState.players[0]}
            isCurrentTurn={gameState.currentPlayerIndex === 0}
            position="bottom"
            isThinking={false}
            lastPlay={gameState.phase === 'playing' ? getLastPlayForPlayer(0) : null}
            humanPlayerId={0}
          />
        </div>

        <ScoreBoard players={gameState.players} scores={gameState.scores} />

        <div className="controls-bar">
          {gameState.phase === 'bidding' && (
            <BidPanel
              currentBid={gameState.biddingState.highestBid}
              onBid={handleBid}
              disabled={!isHumanBidding}
            />
          )}

          {gameState.phase === 'playing' && isHumanTurn && (
            <div className="play-controls">
              <button
                className="play-btn"
                onClick={handlePlay}
                disabled={selectedCardIds.length === 0}
              >
                出牌
              </button>
              <button
                className="pass-btn"
                onClick={handlePass}
                disabled={gameState.playingState.lastPlayerIndex === 0 || !gameState.playingState.lastPlay}
              >
                不出
              </button>
            </div>
          )}
        </div>

        {playNotice && (
          <div className="play-notice" role="status" aria-live="polite">
            {playNotice}
          </div>
        )}
      </div>

      {gameState.phase === 'roundEnd' && (
        <ResultModal
          players={gameState.players}
          landlordIndex={gameState.landlordIndex}
          winnerId={gameState.playingState.lastPlayerIndex}
          multiplier={gameState.multiplier}
          scores={gameState.scores}
          roundNumber={gameState.roundNumber}
          onNewRound={handleNewRound}
        />
      )}
    </div>
  )
}
