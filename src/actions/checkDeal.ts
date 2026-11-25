// CHECK_DEAL — ElizaOS action for Deal Verdict
// ==============================================
// Before the character buys anything, it checks the deal: POST the
// product + found price to Deal Verdict ($0.01/call, USDC on Base via
// x402) and get back real_deal / fake_discount / overpriced / fair,
// the lowest price found elsewhere, the typical price, and cited
// sources. Every price in the answer is extracted from a cited source
// by the endpoint — none is invented.
//
// Payment is handled inside the handler with @x402/fetch. The agent's
// EVM key comes from the character settings (EVM_PRIVATE_KEY) or the
// environment. Keep only a small USDC float in that wallet: each
// check costs exactly $0.01, and a failed check (HTTP 502 — fewer
// than 3 priced sources) is never settled / never charged.

import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
} from "@elizaos/core";
import { privateKeyToAccount } from "viem/accounts";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";

export const DEAL_VERDICT_URL = "https://x402-web-reader.vercel.app/api/deal-verdict";

/**
 * The pre-checkout gate:
 * real_deal / fair => buy at this price.
 * fake_discount / overpriced (and anything unknown) => do NOT buy at
 * this price — use the card's lowestFound, or renegotiate. Fail closed.
 */
export function shouldBuyAtThisPrice(card: { verdict?: string }): boolean {
  return card?.verdict === "real_deal" || card?.verdict === "fair";
}

async function fetchDealVerdict(
  input: { product: string; price: number; compareAtPrice?: number; url?: string },
  privateKey: string,
) {
  const signer = privateKeyToAccount(privateKey as `0x${string}`);
  const client = new x402Client();
  registerExactEvmScheme(client, { signer });
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  const res = await fetchWithPayment(DEAL_VERDICT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Deal Verdict HTTP ${res.status}`);
  return res.json();
}

const AMOUNT_RE = /\$\s?(\d[\d,]*(?:\.\d{1,2})?)/g;
const WAS_RE = /was\s*\$\s?(\d[\d,]*(?:\.\d{1,2})?)/i;
const URL_RE = /https?:\/\/[^\s)]+/i;

/**
 * Parse a chat message into a deal-check input.
 * Price rule: a "was $X" amount is the compare-at price; the first
 * other $ amount is the found price. With no "was", the first amount
 * is the found price and a second amount, if any, is the compare-at.
 */
export function parseDealMessage(text: string): {
  product: string;
  price?: number;
  compareAtPrice?: number;
  url?: string;
} {
  const amounts = [...text.matchAll(AMOUNT_RE)].map((m) => ({
    value: Number(m[1].replace(/,/g, "")),
    raw: m[0],
  }));
  const was = text.match(WAS_RE);
  const wasValue = was ? Number(was[1].replace(/,/g, "")) : undefined;

  let price: number | undefined;
  let compareAtPrice: number | undefined;
  if (wasValue !== undefined) {
    compareAtPrice = wasValue;
    price = amounts.find((a) => a.value !== wasValue)?.value ?? amounts[0]?.value;
  } else if (amounts.length > 0) {
    price = amounts[0].value;
    if (amounts.length > 1) compareAtPrice = amounts[1].value;
  }

  const url = text.match(URL_RE)?.[0];
  const product =
    text
      .replace(URL_RE, " ")
      .replace(AMOUNT_RE, "")
      .replace(/\b(check|deal|buy|for|was|is this a|good|please)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim() || "product";

  return { product, price, compareAtPrice, url };
}

export const checkDealAction: Action = {
  name: "CHECK_DEAL",
  similes: ["DEAL_VERDICT", "IS_THIS_A_DEAL", "CHECK_PRICE", "PRICE_CHECK"],
  description:
    "Check whether a price is a real deal BEFORE buying. Costs $0.01 " +
    "via x402. Send a product name and the price found; returns " +
    "real_deal / fake_discount / overpriced / fair, the lowest price " +
    "found elsewhere, the typical price, and cited sources. Use " +
    "whenever a purchase, checkout, or Black Friday / Cyber Monday " +
    "deal is being considered.",

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? "").toLowerCase();
    return /\$\s?\d/.test(text) || text.includes("deal") || text.includes("buy");
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const text = message.content?.text ?? "";
    const { product, price, compareAtPrice, url } = parseDealMessage(text);
    if (price === undefined) {
      await callback?.({
        text: 'Tell me the product and the price you found (e.g. "AirPods Pro 2 for $189, was $249") and I\'ll check if it\'s a real deal for $0.01.',
      });
      return { success: false, error: "no_price" } as any;
    }

    const privateKey =
      (runtime.getSetting?.("EVM_PRIVATE_KEY") as string) || process.env.EVM_PRIVATE_KEY;
    if (!privateKey) {
      await callback?.({
        text: "Deal Verdict is not configured: set EVM_PRIVATE_KEY (a wallet with a small USDC float on Base) in the character settings.",
      });
      return { success: false, error: "no_key" } as any;
    }

    try {
      const card: any = await fetchDealVerdict({ product, price, compareAtPrice, url }, privateKey);
      const buy = shouldBuyAtThisPrice(card);
      const reply =
        `Deal Verdict for ${card.product ?? product} at $${price}: **${card.verdict}**\n` +
        `Lowest found: $${card.lowestFound?.price} (${card.lowestFound?.store ?? "source"})\n` +
        `Typical price: $${card.typicalPrice} — you save $${card.savingsVsTypical} vs typical\n` +
        (buy
          ? "Gate: OK to buy at this price."
          : "Gate: do NOT buy at this price — use the lowest-found source instead.");
      await callback?.({ text: reply, actions: ["CHECK_DEAL"] });
      return { success: true, data: card } as any;
    } catch (err) {
      await callback?.({
        text: "I couldn't get a verdict — not enough priced sources right now, and a failed check is never charged. Try again shortly.",
      });
      return { success: false, error: String(err) } as any;
    }
  },

  examples: [
    [
      {
        name: "user",
        content: { text: "Found AirPods Pro 2 for $189, was $249 — good deal?" },
      },
      {
        name: "agent",
        content: {
          text: "Checking that price before you buy — one moment.",
          actions: ["CHECK_DEAL"],
        },
      },
    ],
    [
      {
        name: "user",
        content: { text: "This TV is $899 for Black Friday, is it actually a deal?" },
      },
      {
        name: "agent",
        content: {
          text: "Running the deal check on that price now.",
          actions: ["CHECK_DEAL"],
        },
      },
    ],
  ] as any,
};
