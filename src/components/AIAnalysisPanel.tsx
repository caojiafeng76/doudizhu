import type { AIAnalysisResult } from '../game/deepseekAI.ts'
import { formatAIAnalysisRecommendation } from './aiAnalysisPresentation.ts'

interface AIAnalysisPanelProps {
  status: 'loading' | 'ready' | 'unavailable'
  result: AIAnalysisResult | null
}

export function AIAnalysisPanel({ status, result }: AIAnalysisPanelProps) {
  const candidate = result?.candidate ?? null
  const analysis = result?.analysis ?? null
  const recommendation = formatAIAnalysisRecommendation(candidate)

  return (
    <aside
      className={`ai-analysis-panel ai-analysis-panel-${status}`}
      role="status"
      aria-live="polite"
    >
      <div className="ai-analysis-heading">
        <span className="ai-analysis-mark" aria-hidden="true" />
        <h2>AI 分析</h2>
      </div>

      {status === 'loading' && (
        <div className="ai-analysis-loading">
          <span>正在分析你的手牌…</span>
          <span className="thinking-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
      )}

      {status !== 'loading' && (
        <>
          <div className="ai-analysis-recommendation">
            <span className="ai-analysis-label">建议</span>
            <strong>
              {status === 'unavailable' && !candidate
                ? '暂不可用'
                : recommendation}
            </strong>
          </div>

          {status === 'unavailable' && (
            <p className="ai-analysis-message">
              {result?.message ?? '分析暂不可用，你可以按自己的判断出牌'}
            </p>
          )}

          {status === 'ready' && (
            <>
              <section className="ai-analysis-section">
                <h3>为什么这样出</h3>
                <p>{analysis?.why ?? '暂无详细分析'}</p>
              </section>
              <section className="ai-analysis-section">
                <h3>对手考虑</h3>
                <p>{analysis?.opponent ?? '暂无详细分析'}</p>
              </section>
              <section className="ai-analysis-section">
                <h3>判断依据</h3>
                {analysis?.factors.length ? (
                  <div className="ai-analysis-factors">
                    {analysis.factors.map((factor) => (
                      <span key={factor}>{factor}</span>
                    ))}
                  </div>
                ) : (
                  <p>暂无详细分析</p>
                )}
              </section>
            </>
          )}

          {status === 'unavailable' && candidate && (
            <p className="ai-analysis-local">本地建议：{recommendation}</p>
          )}
        </>
      )}
    </aside>
  )
}
