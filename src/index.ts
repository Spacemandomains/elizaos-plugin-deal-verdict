// @thewinnerscircle/plugin-deal-verdict
// ========================================
// Pre-checkout deal checking for ElizaOS characters.
// One action: CHECK_DEAL — $0.01/call via x402, no API key.
//
// Add to a character file:
//   "plugins": ["@thewinnerscircle/plugin-deal-verdict"]
// and set EVM_PRIVATE_KEY in the character settings / .env
// (a wallet holding a small USDC float on Base).

import type { Plugin } from "@elizaos/core";
import { checkDealAction } from "./actions/checkDeal.js";

export const dealVerdictPlugin: Plugin = {
  name: "plugin-deal-verdict",
  description:
    "Deal Verdict — pre-checkout price check for shopping agents ($0.01/call via x402). " +
    "real_deal / fake_discount / overpriced / fair, with the lowest price found and cited sources.",
  actions: [checkDealAction],
  evaluators: [],
  providers: [],
} as Plugin;

export default dealVerdictPlugin;
export { checkDealAction } from "./actions/checkDeal.js";
