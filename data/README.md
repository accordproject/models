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
| [`examples/`](./examples) | — | Standalone example instances of `ApproximateMonetaryAmount` and `PreciseMonetaryAmount`. |

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

## Precision & arithmetic

`PreciseMonetaryAmount.value` is an `IntegerAmount` — an **exact integer
mantissa encoded as a string** (`scalar IntegerAmount extends String
regex=/^(0|-?[1-9][0-9]*)$/`). The amount is `value × 10^(−unit.scale)`.

Encoding the mantissa as a string makes it **exact at any magnitude and scale**:
it is not bounded by the 2^53 limit of a JSON number / IEEE-754 double, and it
is never silently truncated by a JSON parser or lost across languages. So
18-decimal tokens (`1500000000000000000` wei = 1.5 ETH), aggregate balances,
and fiat minor units are all represented exactly.

The trade-off is that `value` is a typed integer string, not a native number —
clients convert once at the boundary and then do exact integer arithmetic.
**You do not need to build a money library for this**: the shape (integer
mantissa + scale) maps directly onto existing arbitrary-precision money
libraries. The recommended path is a thin adapter over **Dinero.js v2** with the
bigint calculator (`MonetaryUnit` → `currency { code, base: 10, exponent: scale }`,
`value` → `BigInt(amount)`), which gives exact add/subtract/allocate/compare and
locale formatting for free. `big.js` / `bignumber.js` / `decimal.js` work
equally well. See [#187](https://github.com/accordproject/models/issues/187).
