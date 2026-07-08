import { useMemo } from 'react'
import type { Card as CardType } from '../game/types'
import { Card } from './Card'

interface HandProps {
  cards: CardType[]
  selectedCardIds: number[]
  onCardClick?: (cardId: number) => void
  isHuman: boolean
}

const HAND_MAX_WIDTH = 880
const HAND_CARD_GAP = 34

export function Hand({ cards, selectedCardIds, onCardClick, isHuman }: HandProps) {
  const { cardWidth, marginLeft } = useMemo(() => {
    if (cards.length <= 1) return { cardWidth: 64, marginLeft: 0 }
    const totalCardWidth = HAND_CARD_GAP * cards.length
    const overflow = totalCardWidth - HAND_MAX_WIDTH
    if (overflow <= 0) return { cardWidth: 64, marginLeft: HAND_CARD_GAP - 64 }
    const overlap = Math.min(40, overflow / (cards.length - 1))
    return { cardWidth: 64, marginLeft: Math.round(64 - overlap) }
  }, [cards.length])

  if (!isHuman) {
    return (
      <div className="ai-hand">
        <div className="mini-cards">
          {cards.slice(0, Math.min(cards.length, 12)).map((_, i) => (
            <div key={i} className="mini-card" />
          ))}
        </div>
        <span className="card-count">{cards.length}张</span>
      </div>
    )
  }

  return (
    <div className="human-hand">
      {cards.map((card, i) => (
        <Card
          key={card.id}
          card={card}
          selected={selectedCardIds.includes(card.id)}
          onClick={() => onCardClick?.(card.id)}
          style={{
            width: `${cardWidth}px`,
            marginLeft: i === 0 ? 0 : `${marginLeft}px`,
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  )
}
