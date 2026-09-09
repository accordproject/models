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
| [`slip44.json`](./slip44.json) | `slip44` | Illustrative sample of native L1 coins (BTC, ETH, HBAR, SOL, SUI) keyed by SLIP-0044 ticker, with their native decimals. |
| [`examples/`](./examples) | — | Standalone example instances of `ApproximateAmount` and `PreciseAmount`. |

## Format

Each registry is a `CurrencyRegistry`: a `scheme` plus a `units` map keyed by
unit code, where each value is a `Unit`.

```json
{
  "$class": "org.accordproject.money.reference@1.0.0.CurrencyRegistry",
  "scheme": "iso4217",
  "units": {
    "USD": { "$class": "org.accordproject.money@1.0.0.Unit", "code": "USD", "scheme": "iso4217", "scale": 2 },
    "JPY": { "$class": "org.accordproject.money@1.0.0.Unit", "code": "JPY", "scheme": "iso4217", "scale": 0 }
  }
}
```

A consumer loads the registry for a scheme and indexes `units` by code to
resolve the canonical `Unit` — and to validate that an amount's unit
carries the standard `scale` for its scheme.

### Native HBAR

Native HBAR uses its registered SLIP-0044 coin type (`3030`) and eight decimal
places (tinybars):

```json
{
  "$class": "org.accordproject.money@1.0.0.PreciseAmount",
  "unscaledValue": "50000",
  "unit": {
    "$class": "org.accordproject.money@1.0.0.Unit",
    "code": "HBAR",
    "scheme": "slip44",
    "identifier": "3030",
    "scale": 8
  }
}
```

This represents exactly `0.0005 HBAR`. Network selection (for example,
`hedera:testnet`) belongs in the payment protocol metadata; it is not part of
the SLIP-0044 currency unit identity. Likewise, Hedera x402 uses `0.0.0` as its
rail-specific asset value for native HBAR; that value belongs in the x402
payment requirements, not in `Unit.identifier`. A payment adapter must apply
the selected rail's asset mapping; it must not copy `Unit.identifier` into a
protocol asset field. For example, `slip44:3030` maps to x402 Hedera asset
`0.0.0`, while retaining the exact amount and scale.

HTS fungible tokens are distinct assets rather than denominations of native
HBAR. They should use a chain-scoped identifier (for example a CAIP-19 asset
type containing the Hedera network and token ID), with the token's own decimal
scale. They must not reuse HBAR's `slip44:3030` identity or assume HBAR's scale.

> Note: serializing a `code → Unit` map where the value concept is
> imported from another namespace requires concerto-core with the fix from
> accordproject/concerto#1279. The data files here are authored directly as JSON
> and each entry is validated individually as a `Unit`.

## ISO 4217 scales

Default `scale` is `2`. Exceptions applied:

- **0** — `BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX UYI VND VUV XAF XOF XPF`, and codes with no minor unit (precious metals `XAU XAG XPT XPD`, bond-market units `XBA XBB XBC XBD`, and `XDR XSU XUA XTS XXX`).
- **3** — `BHD IQD JOD KWD LYD OMR TND`
- **4** — `CLF`

A full ISO 4217 *active-list* audit (pruning retired codes such as `VEF`,
`HRK`, `SLL`) is deferred; this initial table inherits the `money@0.3.0` code
set and adds `VES`.

## Precision & arithmetic

`PreciseAmount.unscaledValue` is a `BigInteger` — an **exact integer
encoded as a string** (`scalar BigInteger extends String
regex=/^(0|-?[1-9][0-9]*)$/`). Following Java's `BigDecimal` model, the amount
is `unscaledValue × 10^(−unit.scale)`.

Encoding the unscaled value as a string makes it **exact at any magnitude and
scale**: it is not bounded by the 2^53 limit of a JSON number / IEEE-754 double,
and it is never silently truncated by a JSON parser or lost across languages. So
18-decimal tokens (`1500000000000000000` wei = 1.5 ETH), aggregate balances,
and fiat minor units are all represented exactly.

The trade-off is that `unscaledValue` is a typed integer string, not a native
number — clients convert once at the boundary and then do exact integer
arithmetic. **You do not need to build a money library for this**: the shape
(unscaled value + scale) maps directly onto existing arbitrary-precision money
libraries. The recommended path is a thin adapter over **Dinero.js v2** with the
bigint calculator (`Unit` → `currency { code, base: 10, exponent: scale }`,
`unscaledValue` → `BigInt(amount)`), which gives exact add/subtract/allocate/compare and
locale formatting for free. `big.js` / `bignumber.js` / `decimal.js` work
equally well. See [#187](https://github.com/accordproject/models/issues/187).
