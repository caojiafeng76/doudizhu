import type { CSSProperties, MouseEventHandler } from 'react'
import type { Card as CardType } from '../game/types'
import { getCardDisplay } from '../game/deck'

interface CardProps {
  card: CardType
  selected?: boolean
  highlight?: 'bomb'
  onClick?: () => void
  onMouseDown?: MouseEventHandler<HTMLDivElement>
  onMouseEnter?: MouseEventHandler<HTMLDivElement>
  onContextMenu?: MouseEventHandler<HTMLDivElement>
  faceDown?: boolean
  size?: 'small' | 'medium' | 'large'
  style?: CSSProperties
}

const SUIT_ASSET_CODES = {
  spade: 'S',
  heart: 'H',
  diamond: 'D',
  club: 'C',
} as const

function getCardAssetPath(card: CardType): string {
  if (card.suit === 'joker') {
    return card.rank === 'big' ? '/cards/Joker2.svg' : '/cards/Joker1.svg'
  }

  const rank = card.rank === '10' ? '10' : card.rank[0].toUpperCase()
  return `/cards/${rank}${SUIT_ASSET_CODES[card.suit]}.svg`
}

export function Card({
  card,
  selected,
  highlight,
  onClick,
  onMouseDown,
  onMouseEnter,
  onContextMenu,
  faceDown,
  size = 'medium',
  style,
}: CardProps) {
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
  const highlightClass = highlight === 'bomb' ? 'bomb-highlight' : ''

  return (
    <div
      className={`card ${colorClass} ${sizeClass} ${selected ? 'selected' : ''} ${highlightClass} ${isJoker ? 'joker ' + jokerSizeClass : ''}`}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onContextMenu={onContextMenu}
      style={style}
    >
      <img className="card-face-image" src={getCardAssetPath(card)} alt={`${display.rank}${display.suit}`} draggable={false} />
      <div className="card-fallback">
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
    </div>
  )
}
