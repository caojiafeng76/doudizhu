import type { Player, PlayRecord } from '../game/types'
import { Card } from './Card'

interface PlayerSeatProps {
  player: Player
  isCurrentTurn: boolean
  position: 'bottom' | 'left' | 'top' | 'right'
  isThinking?: boolean
  lastPlay?: PlayRecord | null
  humanPlayerId: number
}

const EMOJI_MAP: Record<number, string> = {
  0: '🧑',
  1: '🤖',
  2: '🎭',
  3: '🦊',
}

export function PlayerSeat({ player, isCurrentTurn, position, isThinking, lastPlay, humanPlayerId }: PlayerSeatProps) {
  const isHuman = player.id === humanPlayerId
  const showPlay = lastPlay && !lastPlay.passed && lastPlay.cards.length > 0
  const showPass = lastPlay && lastPlay.passed

  return (
    <div
      className={`player-seat ${position} ${isCurrentTurn ? 'active' : ''} ${player.isLandlord ? 'landlord' : ''}`}
    >
      <div className="player-info">
        <div className="player-avatar">
          {EMOJI_MAP[player.id] || '🎮'}
        </div>
        <span className="player-name">{player.name}</span>
        {player.isLandlord && <span className="landlord-badge">地主</span>}
      </div>
      <div className="player-card-count">
        <span className="card-icon" />
        {player.hand.length}张
      </div>
      {isThinking && isCurrentTurn && (
        <div className="thinking-dots">
          <span />
          <span />
          <span />
        </div>
      )}
      {showPlay && (
        <div className={`player-played-cards ${position} ${isHuman ? 'human' : ''}`}>
          {lastPlay.cards.map(card => (
            <Card key={card.id} card={card} size="small" />
          ))}
        </div>
      )}
      {showPass && (
        <div className={`player-played-pass ${position}`}>
          <span className="pass-text">不出</span>
        </div>
      )}
    </div>
  )
}
