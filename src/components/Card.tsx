import type { CSSProperties } from 'react'
import type { Card as CardType } from '../game/types'
import { getCardDisplay } from '../game/deck'

interface CardProps {
  card: CardType
  selected?: boolean
  onClick?: () => void
  faceDown?: boolean
  size?: 'small' | 'medium' | 'large'
  style?: CSSProperties
}

export function Card({ card, selected, onClick, faceDown, size = 'medium', style }: CardProps) {
  const display = getCardDisplay(card)
  const sizeClass = size === 'small' ? 'card-small' : size === 'large' ? 'card-large' : ''

  if (faceDown) {
    return (
      <div className={`card card-back ${sizeClass}`} style={style}>
        <div className="card-back-pattern" />
      </div>
    )
  }

  const colorClass = display.color === '#d32f2f' ? 'red' : 'black'
  const isJoker = card.suit === 'joker'
  const jokerSizeClass = size === 'small' ? 'joker-small' : ''

  return (
    <div
      className={`card ${colorClass} ${sizeClass} ${selected ? 'selected' : ''} ${isJoker ? 'joker ' + jokerSizeClass : ''}`}
      onClick={onClick}
      style={style}
    >
      <div className="card-top">
        <span className="card-rank">{display.rank}</span>
        <span className="card-suit">{display.suit}</span>
      </div>
      <div className="card-center">{display.suit}</div>
      <div className="card-bottom">
        <span className="card-rank">{display.rank}</span>
        <span className="card-suit">{display.suit}</span>
      </div>
    </div>
  )
}
