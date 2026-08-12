import { describe, expect, it } from "vitest";
import { calculateReviewScore, type ReviewScoreInput } from "./reviewScore";

const samples: Array<{ input: ReviewScoreInput; raw: number; display: number }> = [
  {
    input: {
      review: { 5: 54, 4: 4, 3: 1, 2: 1, 1: 3 },
      rating: { 5: 23, 4: 8, 3: 7, 2: 4, 1: 6 },
    },
    raw: 476 / 111,
    display: 4.3,
  },
  {
    input: {
      review: { 5: 26, 4: 9, 3: 3, 2: 1, 1: 4 },
      rating: { 5: 0, 4: 4, 3: 3, 2: 3, 1: 6 },
    },
    raw: 218 / 59,
    display: 3.7,
  },
  {
    input: {
      review: { 5: 30, 4: 4, 3: 0, 2: 0, 1: 0 },
      rating: { 5: 0, 4: 1, 3: 0, 2: 6, 1: 3 },
    },
    raw: 185 / 44,
    display: 4.2,
  },
  {
    input: {
      review: { 5: 17, 4: 3, 3: 1, 2: 1, 1: 3 },
      rating: { 5: 2, 4: 1, 3: 3, 2: 2, 1: 3 },
    },
    raw: 135 / 36,
    display: 3.7,
  },
  {
    input: {
      review: { 5: 15, 4: 5, 3: 0, 2: 0, 1: 1 },
      rating: { 5: 4, 4: 2, 3: 0, 2: 0, 1: 2 },
    },
    raw: 126 / 29,
    display: 4.3,
  },
];

describe("calculateReviewScore", () => {
  it.each(samples)("matches the validated operating samples", ({ input, raw, display }) => {
    const result = calculateReviewScore(input);
    expect(result.rawScore).toBeCloseTo(raw, 8);
    expect(result.displayScore).toBe(display);
  });

  it("keeps an exact half-tenth boundary on the lower display score", () => {
    const boundary = calculateReviewScore({
      review: { 5: 1, 4: 1, 3: 2, 2: 0, 1: 0 },
      rating: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    });
    expect(boundary.rawScore).toBe(3.75);
    expect(boundary.displayScore).toBe(3.7);
    expect(boundary.isBoundary).toBe(true);
  });

  it("normalizes negative and fractional counts", () => {
    const result = calculateReviewScore({
      review: { 5: 2.9, 4: -3, 3: 0, 2: 0, 1: 0 },
      rating: { 5: 0, 4: 0, 3: 0, 2: 0, 1: Number.NaN },
    });
    expect(result.totalCount).toBe(2);
    expect(result.totalPoints).toBe(10);
    expect(result.displayScore).toBe(5);
  });
});
