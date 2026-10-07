# RiverMath

Honest poker odds, computed instead of memorized. The rule of 2 and 4 is a lie of
convenience - RiverMath shows the exact number next to the shortcut, prices a call
from the pot and the bet, and settles hand-vs-hand arguments by enumerating every
remaining runout.

**Live:** https://ilanis-agent.github.io/rivermath/ (app: `app.html`)

## What it does

1. **Outs, fact-checked.** Enter outs (or pick one of the six classic draws) and see
   exact turn, river-after-miss, and either-street probabilities via hypergeometric
   combinatorics, side by side with the rule of 2 / rule of 4 and the shortcut's
   signed error in percentage points.
2. **Pot odds, translated.** Pot and bet in, required equity out (`bet / (pot + 2*bet)`),
   plus the break-even number of clean outs on one street and a verdict table showing
   whether each classic draw clears the price on direct odds.
3. **Hand vs hand, enumerated.** Two hold'em hands and a board of 0, 3, 4 or 5 cards.
   Flop (990 runouts) and turn (44) are enumerated exactly; a full board is a pure
   showdown; preflop (1.7M boards) uses a fixed-seed Monte Carlo with the sample
   count and seed printed next to the result.

## What it does not do (said out loud)

- Educational calculator only. Not gambling advice, not a game, no real-money play.
- Hand-vs-hand only: no ranges, no multiway pots, no implied-odds modeling.
- Draw math assumes every out is clean (a flush draw that pairs the board is not
  always 9 clean outs).
- Preflop equity is a **Monte Carlo estimate** (200,000 boards, fixed seed 407),
  labeled as such. It is not an exact number.
- No storage, no network calls, no accounts. Everything runs locally in the page.

## Files

- `index.html` - landing page
- `app.html` - the three-part odds machine (single page, no build step)
- `engine.js` - pure logic: card parsing, 5/7-card evaluator, exact outs and pot
  math, exact runout enumeration, seeded Monte Carlo. Runs in the browser and Node.
- `tests/oracle.py` - independent brute-force oracle (fractions + itertools) that
  generates `tests/expected.json`
- `tests/run_tests.js` - 171 checks: engine vs oracle for outs, pot odds, evaluator
  categories and exact equities; Monte Carlo determinism and published-value bands;
  parser and validation behavior.

## Tests

```
python3 tests/oracle.py   # regenerate tests/expected.json
node tests/run_tests.js   # 171 passing
```

The hand evaluator packs category + five tie-break ranks into one comparable
integer (base 15, ties zero-padded to length 5), so any two 5-card scores order
correctly, wheels included.
