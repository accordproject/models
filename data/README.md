# Money reference data

Canonical reference data for `org.accordproject.money@1.0.0`, as validated
instances of `org.accordproject.money.reference@1.0.0.CurrencyRegistry`.

These files are **source-of-truth data**, not published models. They live
outside `src/` so the model build (`build.js`, which only processes `src/`) does
not touch them. A distribution channel for this data (HTTP alongside the models,
an npm helper package, or bundling helpers into a Cicero package) is under
discussion — see the tracking issue.

## Files

| File | Scheme | Contents |
|------|--------|----------|
| [`iso4217.json`](./iso4217.json) | `iso4217` | Fiat currencies. Codes inherited from `money@0.3.0` plus `VES`; scales are ISO 4217 minor units. |
| [`erc20.json`](./erc20.json) | `erc20` | Illustrative sample of ERC-20 tokens (USDC, USDT, DAI, WETH, WBTC) with their token decimals. |
| [`slip44.json`](./slip44.json) | `slip44` | Illustrative sample of native L1 coins (BTC, ETH, SOL, SUI) keyed by SLIP-0044 ticker, with their native decimals. |
| [`examples/`](./examples) | — | Standalone example instances of `MonetaryAmount` and `FixedPointMonetaryAmount`. |

## Format

Each registry is a `CurrencyRegistry`: a `scheme` plus a `units` map keyed by
unit code, where each value is a `MonetaryUnit`.

```json
{
  "$class": "org.accordproject.money.reference@1.0.0.CurrencyRegistry",
  "scheme": "iso4217",
  "units": {
    "USD": { "$class": "org.accordproject.money@1.0.0.MonetaryUnit", "code": "USD", "scheme": "iso4217", "scale": 2 },
    "JPY": { "$class": "org.accordproject.money@1.0.0.MonetaryUnit", "code": "JPY", "scheme": "iso4217", "scale": 0 }
  }
}
```

A consumer loads the registry for a scheme and indexes `units` by code to
resolve the canonical `MonetaryUnit` — and to validate that an amount's unit
carries the standard `scale` for its scheme.

> Note: serializing a `code → MonetaryUnit` map where the value concept is
> imported from another namespace requires concerto-core with the fix from
> accordproject/concerto#1279. The data files here are authored directly as JSON
> and each entry is validated individually as a `MonetaryUnit`.

## ISO 4217 scales

Default `scale` is `2`. Exceptions applied:

- **0** — `BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX UYI VND VUV XAF XOF XPF`, and codes with no minor unit (precious metals `XAU XAG XPT XPD`, bond-market units `XBA XBB XBC XBD`, and `XDR XSU XUA XTS XXX`).
- **3** — `BHD IQD JOD KWD LYD OMR TND`
- **4** — `CLF`

A full ISO 4217 *active-list* audit (pruning retired codes such as `VEF`,
`HRK`, `SLL`) is deferred; this initial table inherits the `money@0.3.0` code
set and adds `VES`.

## ⚠️ Precision limit of `FixedPointMonetaryAmount`

`FixedPointMonetaryAmount.value` is a Concerto `Long`, which concerto-core
represents as a JavaScript `number` — exact only up to `Number.MAX_SAFE_INTEGER`
(2^53 − 1 ≈ 9.0 × 10^15).

- **Fiat is safe.** At `scale` 2 that is ~90 trillion units — ample.
- **High-decimal tokens are not.** An 18-decimal token (e.g. ETH at
  `scale` 18) overflows above ~0.009 of a unit; e.g. `1500000000000000001` wei
  round-trips to `1500000000000000000`.

This is why the `erc20.json` sample and examples use magnitudes within the safe
range, and why a string-valued alternative for high-precision schemes is an
open question on the design issue.
