import { describe, expect, it } from "vitest";
import { calculateReferralFee, getDefaultReferralCategory } from "./referralFees";

describe("referral fee engine", () => {
  it("matches browse nodes to the recommended official fee category", () => {
    expect(getDefaultReferralCategory("US", "Home & Kitchen")).toBe("home-kitchen");
    expect(getDefaultReferralCategory("JP", "ホーム＆キッチン")).toBe("home-kitchen");
  });

  it("applies US price-threshold and progressive category rules", () => {
    expect(calculateReferralFee("US", "beauty-health", 10).fee).toBeCloseTo(0.8, 6);
    expect(calculateReferralFee("US", "beauty-health", 11).fee).toBeCloseTo(1.65, 6);
    expect(calculateReferralFee("US", "electronics-accessories", 150).fee).toBeCloseTo(19, 6);
    expect(calculateReferralFee("US", "home-kitchen", 29.99).fee).toBeCloseTo(4.50, 6);
  });

  it("applies the per-item minimum referral fee", () => {
    const quote = calculateReferralFee("US", "home-kitchen", 1);
    expect(quote.fee).toBeCloseTo(0.30, 6);
    expect(quote.minimumApplied).toBe(true);
  });

  it("supports Japan low-price tiers and minimum fees", () => {
    expect(calculateReferralFee("JP", "home-kitchen", 700).fee).toBeCloseTo(35, 6);
    expect(calculateReferralFee("JP", "home-kitchen", 1000).fee).toBeCloseTo(154, 6);
    expect(calculateReferralFee("JP", "home-kitchen", 100).fee).toBeCloseTo(30, 6);
  });
});
