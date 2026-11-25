# Publish — Deal Verdict plugin

This package is built, type-checked (`tsc` clean), runtime-loaded,
test-verified (4/4 under `bun test`), and `npm pack --dry-run` verified.
It has **not** been published or pushed — that is the parent agent's /
Wilfred's step, mirroring how `@thewinnerscircle/plugin-token-verdict`
was published on 2026-11-25.

## What changed since the Token Verdict publish (read first)

- **Scope is already correct.** The npm package is
  `@thewinnerscircle/plugin-deal-verdict` — `thewinnerscircle` is
  Wilfred's own npm username/scope (recovered and verified 2026-11-25),
  so there is no scope rejection to fix. The internal plugin name stays
  `plugin-deal-verdict`.
- **There is no registry PR step anymore.** The old
  `elizaos-plugins/registry` GitHub repo **no longer exists** (verified
  2026-11-25: the repo 404s and the `elizaos-plugins` org is empty —
  "Plugins have been migrated into the elizaos/eliza core repo"). The
  current ElizaOS registry **syncs automatically from npm**, so
  publishing the npm package is the registry submission. Do NOT go
  looking for a registry repo to PR against.
- **Repo topics are a registry requirement.** When the GitHub repo is
  created, set its topics to: `elizaos-plugins`, `elizaos`, `x402`
  (same as the token-verdict repo).

## Publish steps

```bash
# 1. GitHub repo (parent agent does this in Wilfred's Chrome, signed in
#    as Spacemandomains — same as elizaos-plugin-token-verdict)
#    Create public repo: Spacemandomains/elizaos-plugin-deal-verdict
#    Then set repo topics: elizaos-plugins, elizaos, x402

# 2. Push this folder (git is already initialised, main branch, one commit)
git remote add origin git@github.com:Spacemandomains/elizaos-plugin-deal-verdict.git
git push -u origin main
# (On this VM, pushes need the blocking-proxy SSH variant:
#  GIT_SSH_COMMAND="ssh -F /home/hatch/.ssh/config -o ProxyCommand='python3 /home/hatch/.ssh/proxy-connect-blocking.py %h %p'")

# 3. Publish to npm — on Wilfred's Mac, where npm is logged in as
#    thewinnerscircle (2FA security key "AI Agent" enabled; a publish
#    will prompt for the key / browser auth, as the token publish did)
cd elizaos-plugin-deal-verdict
npm publish --access public
# → package live immediately at
#   https://www.npmjs.com/package/@thewinnerscircle/plugin-deal-verdict
# → registry picks it up via the automatic npm sync (no PR)

# Optional CLI validation first (Mac, home-prefix install — global
# /usr/local install fails with EACCES and bare npx does not launch
# the elizaos binary):
npm install -g --prefix ~/.npm-global @elizaos/cli
~/.npm-global/bin/elizaos publish --test
```

Fallback if `elizaos publish --test` complains about anything: the
plain `npm publish --access public` above is sufficient — it is how
the token plugin's npm side effectively landed, and the registry sync
only needs npm + the repo topics.

## Verified before handoff (2026-11-25, Muse VM, nothing paid)

- Live endpoint dry-run: unpaid POST returned HTTP 402; decoded
  `payment-required` header: amount 10000 atomic USDC = **$0.01**,
  network **eip155:8453 (Base)**, asset USDC
  `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`,
  payTo `0xea8B7221507d1A0549e1ab96000a54401A7fDaC1`. Nothing was paid.
- `npm run build` (tsc) — clean, exit 0.
- Runtime load of `dist/index.js` — plugin `plugin-deal-verdict`,
  actions `[CHECK_DEAL]`.
- `CHECK_DEAL.validate()` — true with a price/deal message, false without.
- Gate helper `shouldBuyAtThisPrice()` — real_deal/fair → true;
  fake_discount/overpriced/missing → false (fail closed).
- Message parser — "Found AirPods Pro 2 for $189, was $249" →
  price 189, compareAtPrice 249.
- `bun test` — 4 pass, 0 fail.
- `npm pack --dry-run` — 8 files, 57.6 kB tarball (dist, images, README, package.json).
- Images: `images/logo.jpg` 400×400, 19,064 B (<500 KB); `images/banner.jpg`
  1280×640, 67,281 B (<1 MB) — both meet registry sizes.
