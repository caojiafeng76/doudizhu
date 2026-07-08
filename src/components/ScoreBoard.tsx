import type { Player } from '../game/types'

interface ScoreBoardProps {
  players: Player[]
  scores: number[]
}

export function ScoreBoard({ players, scores }: ScoreBoardProps) {
  return (
    <div className="score-board">
      <h3>总积分</h3>
      <div className="score-list">
        {players.map(player => {
          const score = scores[player.id]
          const scoreClass = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral'
          return (
            <div key={player.id} className="score-item">
              <span>
                {player.name}
                {player.isLandlord && <span className="landlord-tag">[地主]</span>}
              </span>
              <span className={`score-value ${scoreClass}`}>{score}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
