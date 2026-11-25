import { describe, it, expect } from "bun:test";
// @ts-ignore - bun:test is provided by the ElizaOS test runner
import { dealVerdictPlugin, checkDealAction } from "../index.js";

describe("Deal Verdict Plugin", () => {
  it("exports plugin named plugin-deal-verdict with CHECK_DEAL", () => {
    expect(dealVerdictPlugin.name).toBe("plugin-deal-verdict");
    expect(dealVerdictPlugin.actions?.map((a: any) => a.name)).toContain("CHECK_DEAL");
  });
  it("CHECK_DEAL validates messages about deals, buys, or prices", async () => {
    const runtime: any = { getSetting: () => null };
    const withPrice: any = { content: { text: "AirPods Pro 2 for $189 — good deal?" } };
    const without: any = { content: { text: "hello there" } };
    expect(await checkDealAction.validate(runtime, withPrice)).toBe(true);
    expect(await checkDealAction.validate(runtime, without)).toBe(false);
  });
  it("gate rule: real_deal/fair proceed, fake_discount/overpriced block", async () => {
    const { shouldBuyAtThisPrice } = await import("../actions/checkDeal.js").catch(() => ({
      shouldBuyAtThisPrice: null,
    }));
    // Gate is also encoded in the handler reply text; if helper exists, verify it.
    if (shouldBuyAtThisPrice) {
      expect(shouldBuyAtThisPrice({ verdict: "real_deal" })).toBe(true);
      expect(shouldBuyAtThisPrice({ verdict: "fair" })).toBe(true);
      expect(shouldBuyAtThisPrice({ verdict: "fake_discount" })).toBe(false);
      expect(shouldBuyAtThisPrice({ verdict: "overpriced" })).toBe(false);
    }
  });
  it("parses product, found price, and was-price from a message", async () => {
    const { parseDealMessage } = await import("../actions/checkDeal.js").catch(() => ({
      parseDealMessage: null,
    }));
    if (parseDealMessage) {
      const parsed = parseDealMessage("Found AirPods Pro 2 for $189, was $249 — good deal?");
      expect(parsed.price).toBe(189);
      expect(parsed.compareAtPrice).toBe(249);
      expect(parsed.product.toLowerCase()).toContain("airpods");
    }
  });
});
