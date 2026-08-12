export const STARS = [5, 4, 3, 2, 1] as const;

export type Star = (typeof STARS)[number];
export type StarCounts = Record<Star, number>;

export interface ReviewScoreInput {
  review: StarCounts;
  rating: StarCounts;
}

export interface ScoreGroupResult {
  counts: StarCounts;
  count: number;
  points: number;
  average: number | null;
}

export interface ReviewScoreResult {
  review: ScoreGroupResult;
  rating: ScoreGroupResult;
  combinedCounts: StarCounts;
  totalCount: number;
  totalPoints: number;
  rawScore: number | null;
  displayScore: number | null;
  fiveStarShare: number | null;
  lowStarShare: number | null;
  isBoundary: boolean;
}

export const EMPTY_STAR_COUNTS: StarCounts = {
  5: 0,
  4: 0,
  3: 0,
  2: 0,
  1: 0,
};

export const EMPTY_REVIEW_SCORE_INPUT: ReviewScoreInput = {
  review: { ...EMPTY_STAR_COUNTS },
  rating: { ...EMPTY_STAR_COUNTS },
};

function normalizeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function calculateGroup(source: StarCounts): ScoreGroupResult {
  const counts = { ...EMPTY_STAR_COUNTS };
  let count = 0;
  let points = 0;

  STARS.forEach((star) => {
    counts[star] = normalizeCount(source[star]);
    count += counts[star];
    points += counts[star] * star;
  });

  return {
    counts,
    count,
    points,
    average: count > 0 ? points / count : null,
  };
}

export function calculateReviewScore(input: ReviewScoreInput): ReviewScoreResult {
  const review = calculateGroup(input.review);
  const rating = calculateGroup(input.rating);
  const combinedCounts = { ...EMPTY_STAR_COUNTS };

  STARS.forEach((star) => {
    combinedCounts[star] = review.counts[star] + rating.counts[star];
  });

  const totalCount = review.count + rating.count;
  const totalPoints = review.points + rating.points;
  const rawScore = totalCount > 0 ? totalPoints / totalCount : null;

  // Amazon does not publish its weighting algorithm. The small epsilon preserves
  // the observed operating rule that an exact x.x50 boundary stays on the lower tenth.
  const displayScore = rawScore === null ? null : Math.round((rawScore - 1e-9) * 10) / 10;
  const boundaryDistance = rawScore === null
    ? Number.POSITIVE_INFINITY
    : Math.abs(rawScore - (Math.floor(rawScore * 10) / 10 + 0.05));

  return {
    review,
    rating,
    combinedCounts,
    totalCount,
    totalPoints,
    rawScore,
    displayScore,
    fiveStarShare: totalCount > 0 ? combinedCounts[5] / totalCount : null,
    lowStarShare: totalCount > 0 ? (combinedCounts[1] + combinedCounts[2] + combinedCounts[3]) / totalCount : null,
    isBoundary: boundaryDistance <= 0.01,
  };
}
