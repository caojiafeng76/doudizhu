import type { Card as CardType, AIDifficulty } from '../game/types'
import { Card } from './Card'

interface GameHeaderProps {
  bottomCards: CardType[]
  multiplier: number
  currentPlayerName: string
  roundNumber: number
  aiDifficulty: AIDifficulty
  onDifficultyChange: (difficulty: AIDifficulty) => void
  showBottom: boolean
}

const DIFFICULTY_LABELS: Record<AIDifficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

export function GameHeader({
  bottomCards,
  multiplier,
  currentPlayerName,
  roundNumber,
  aiDifficulty,
  onDifficultyChange,
  showBottom,
}: GameHeaderProps) {
  return (
    <div className="game-header">
      <div className="header-left">
        <span className="round-number">第 {roundNumber} 局</span>
        <span className="multiplier">×{multiplier}</span>
      </div>
      <div className="header-center">
        {showBottom && (
          <div className="bottom-cards">
            <span className="bottom-cards-label">底牌</span>
            {bottomCards.map(card => (
              <Card key={card.id} card={card} size="small" />
            ))}
          </div>
        )}
      </div>
      <div className="header-right">
        <span className="current-turn">
          <span className="turn-indicator" />
          {currentPlayerName}
        </span>
        <select
          value={aiDifficulty}
          onChange={e => onDifficultyChange(e.target.value as AIDifficulty)}
          className="difficulty-select"
        >
          {(['easy', 'medium', 'hard'] as AIDifficulty[]).map(d => (
            <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
