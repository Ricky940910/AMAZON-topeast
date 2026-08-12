import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Beaker,
  Calculator,
  Info,
  RotateCcw,
  Star,
} from "lucide-react";
import {
  EMPTY_STAR_COUNTS,
  STARS,
  calculateReviewScore,
  type ReviewScoreInput,
  type Star as ScoreStar,
  type StarCounts,
} from "./lib/reviewScore";
import { numberInputValue } from "./lib/input";

type ScoreGroup = keyof ReviewScoreInput;

const SAMPLE_INPUT: ReviewScoreInput = {
  review: { 5: 15, 4: 5, 3: 0, 2: 0, 1: 1 },
  rating: { 5: 4, 4: 2, 3: 0, 2: 0, 1: 2 },
};

function emptyInput(): ReviewScoreInput {
  return {
    review: { ...EMPTY_STAR_COUNTS },
    rating: { ...EMPTY_STAR_COUNTS },
  };
}

function cloneCounts(counts: StarCounts): StarCounts {
  return { ...counts };
}

function normalizedInputValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function formatScore(value: number | null, digits = 2): string {
  return value === null ? "--" : value.toFixed(digits);
}

function formatPercent(value: number | null): string {
  return value === null ? "--" : `${(value * 100).toFixed(1)}%`;
}

function ReviewScoreCalculator() {
  const [input, setInput] = useState<ReviewScoreInput>(() => emptyInput());
  const result = useMemo(() => calculateReviewScore(input), [input]);

  const updateCount = (group: ScoreGroup, star: ScoreStar, value: string) => {
    setInput((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [star]: normalizedInputValue(value),
      },
    }));
  };

  const applySample = () => {
    setInput({
      review: cloneCounts(SAMPLE_INPUT.review),
      rating: cloneCounts(SAMPLE_INPUT.rating),
    });
  };

  const clear = () => setInput(emptyInput());

  return (
    <main className="review-score-main">
      <header className="topbar review-score-topbar">
        <div>
          <div className="eyebrow">板块六 · REVIEW SCORE ESTIMATOR</div>
          <h1>链接评分计算</h1>
          <p>合并 VP Review 与 VP 点星 Rating，估算链接原始均分及前台显示分</p>
        </div>
        <div className="review-score-top-actions">
          <button className="rule-link" type="button" onClick={applySample}>
            <Beaker size={15} /> 填入验证样本
          </button>
          <button className="icon-button" type="button" onClick={clear} title="清空数据" aria-label="清空数据">
            <RotateCcw size={17} />
          </button>
        </div>
      </header>

      <div className="review-score-page">
        <section className="review-score-hero" aria-live="polite">
          <div className="review-score-primary">
            <span>预计亚马逊前台显示</span>
            <strong>{result.displayScore === null ? "--" : result.displayScore.toFixed(1)}<small> / 5.0</small></strong>
            <p>运营经验估算值，非 Amazon 官方计算结果</p>
          </div>
          <div className="review-score-hero-grid">
            <div><small>原始加权均分</small><b>{formatScore(result.rawScore, 4)}</b></div>
            <div><small>总评分数</small><b>{result.totalCount || "--"}</b></div>
            <div><small>Review 数量</small><b>{result.review.count || "--"}</b></div>
            <div><small>Rating 数量</small><b>{result.rating.count || "--"}</b></div>
          </div>
        </section>

        <div className="review-score-workspace">
          <section className="review-score-panel review-score-input" aria-labelledby="review-score-input-title">
            <div className="review-score-heading">
              <Calculator size={18} />
              <div>
                <h2 id="review-score-input-title">星级数量录入</h2>
                <p>Review 为 VP 文字评论；Rating 为仅点星评分</p>
              </div>
            </div>

            <div className="score-input-table">
              <div className="score-input-head">
                <span>星级</span>
                <span>VP Review</span>
                <span>VP Rating</span>
              </div>
              {STARS.map((star) => (
                <div className="score-input-row" key={star}>
                  <span className="score-star-label"><Star size={14} fill="currentColor" /> {star} 星</span>
                  <label>
                    <span className="sr-only">{star} 星 VP Review 数量</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={numberInputValue(input.review[star])}
                      onChange={(event) => updateCount("review", star, event.target.value)}
                      placeholder="0"
                    />
                  </label>
                  <label>
                    <span className="sr-only">{star} 星 VP Rating 数量</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={numberInputValue(input.rating[star])}
                      onChange={(event) => updateCount("rating", star, event.target.value)}
                      placeholder="0"
                    />
                  </label>
                </div>
              ))}
            </div>

            <div className="score-input-actions">
              <button type="button" onClick={applySample}><Beaker size={15} /> 示例：29 个评分 / 4.3</button>
              <button type="button" onClick={clear}><RotateCcw size={15} /> 清空</button>
            </div>
          </section>

          <div className="review-score-results">
            <section className="review-score-panel" aria-labelledby="score-overview-title">
              <div className="review-score-heading">
                <BarChart3 size={18} />
                <div>
                  <h2 id="score-overview-title">计算结果</h2>
                  <p>两组数据等权汇总，不额外放大 Review 权重</p>
                </div>
              </div>

              <div className="review-score-metrics">
                <div><span>总评分数</span><strong>{result.totalCount || "--"}</strong></div>
                <div><span>总星分</span><strong>{result.totalCount ? result.totalPoints : "--"}</strong></div>
                <div><span>Review 平均</span><strong>{formatScore(result.review.average)}</strong></div>
                <div><span>Rating 平均</span><strong>{formatScore(result.rating.average)}</strong></div>
                <div><span>5 星占比</span><strong>{formatPercent(result.fiveStarShare)}</strong></div>
                <div><span>1-3 星占比</span><strong>{formatPercent(result.lowStarShare)}</strong></div>
              </div>

              <div className="review-score-formula">
                <div>
                  <span>基础公式</span>
                  <b>(Review 总星分 + Rating 总星分) ÷ (Review 数量 + Rating 数量)</b>
                </div>
                <strong>{result.totalCount ? `${result.totalPoints} ÷ ${result.totalCount} = ${formatScore(result.rawScore, 4)}` : "等待录入数据"}</strong>
              </div>
            </section>

            <section className="review-score-panel" aria-labelledby="score-distribution-title">
              <div className="review-score-heading compact">
                <Star size={18} />
                <div>
                  <h2 id="score-distribution-title">合并星级分布</h2>
                  <p>Review 与 Rating 合并后的结构占比</p>
                </div>
              </div>
              <div className="review-score-distribution">
                {STARS.map((star) => {
                  const count = result.combinedCounts[star];
                  const share = result.totalCount > 0 ? count / result.totalCount : 0;
                  return (
                    <div className="distribution-row" key={star}>
                      <span>{star} 星</span>
                      <div><i style={{ width: `${share * 100}%` }} /></div>
                      <b>{count}</b>
                      <small>{(share * 100).toFixed(1)}%</small>
                    </div>
                  );
                })}
              </div>
            </section>

            {result.isBoundary && result.rawScore !== null && (
              <div className="review-score-alert boundary">
                <AlertTriangle size={17} />
                <div><b>当前结果接近一位小数临界点</b><span>少量新增评分可能改变前台显示分，建议结合未来评价结构做情景测算。</span></div>
              </div>
            )}

            <div className="review-score-alert">
              <Info size={17} />
              <div>
                <b>估算口径说明</b>
                <span>Amazon 未公开完整评分权重。前台结果还可能受评论可信度、时间衰减、异常评价过滤、变体合并及数据同步延迟影响，本工具适合运营预判，不用于反推官方精确算法。</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default ReviewScoreCalculator;
