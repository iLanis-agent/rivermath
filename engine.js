/* RiverMath engine: exact poker draw odds, pot odds, and hand-vs-hand equity.
   Pure logic, no DOM. Used by app.html and tests/run_tests.js. */
(function (root) {
  'use strict';

  var RANK_CHARS = '23456789TJQKA';
  var SUIT_CHARS = 'cdhs';

  function parseCard(tok) {
    if (typeof tok !== 'string' || tok.length !== 2) return null;
    var r = RANK_CHARS.indexOf(tok[0].toUpperCase());
    var s = SUIT_CHARS.indexOf(tok[1].toLowerCase());
    if (r < 0 || s < 0) return null;
    return { r: r + 2, s: s }; // r: 2..14, s: 0..3
  }

  // "Ah Kd" / "AhKd" / "ah,kd" -> array of cards, or {error}
  function parseCards(str) {
    if (typeof str !== 'string') return { error: 'not a string' };
    var cleaned = str.trim().replace(/[\s,;]+/g, ' ').trim();
    if (cleaned === '') return [];
    var toks;
    if (cleaned.indexOf(' ') >= 0) toks = cleaned.split(' ');
    else {
      if (cleaned.length % 2 !== 0) return { error: 'odd length' };
      toks = [];
      for (var i = 0; i < cleaned.length; i += 2) toks.push(cleaned.slice(i, i + 2));
    }
    var out = [];
    for (var j = 0; j < toks.length; j++) {
      var c = parseCard(toks[j]);
      if (!c) return { error: 'bad card: ' + toks[j] };
      out.push(c);
    }
    return out;
  }

  function cardKey(c) { return c.r * 4 + c.s; }
  function hasDuplicates(cards) {
    var seen = {};
    for (var i = 0; i < cards.length; i++) {
      var k = cardKey(cards[i]);
      if (seen[k]) return true;
      seen[k] = 1;
    }
    return false;
  }

  function cardName(c) {
    return RANK_CHARS[c.r - 2] + SUIT_CHARS[c.s];
  }

  // 5-card hand score, single comparable integer. Higher wins.
  function eval5(c5) {
    var rs = c5.map(function (c) { return c.r; }).sort(function (a, b) { return b - a; });
    var flush = true;
    for (var i = 1; i < 5; i++) if (c5[i].s !== c5[0].s) { flush = false; break; }
    var uniq = [];
    for (var u = 0; u < rs.length; u++) if (uniq.indexOf(rs[u]) < 0) uniq.push(rs[u]);
    var straightHigh = 0;
    if (uniq.length === 5) {
      if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
      else if (uniq[0] === 14 && uniq[1] === 5) straightHigh = 5; // wheel
    }
    var cnt = {};
    rs.forEach(function (r) { cnt[r] = (cnt[r] || 0) + 1; });
    var groups = Object.keys(cnt).map(function (r) { return [+r, cnt[r]]; });
    groups.sort(function (a, b) { return b[1] - a[1] || b[0] - a[0]; });
    var cat, tie;
    if (flush && straightHigh) { cat = 8; tie = [straightHigh]; }
    else if (groups[0][1] === 4) { cat = 7; tie = [groups[0][0], groups[1][0]]; }
    else if (groups[0][1] === 3 && groups[1][1] === 2) { cat = 6; tie = [groups[0][0], groups[1][0]]; }
    else if (flush) { cat = 5; tie = rs; }
    else if (straightHigh) { cat = 4; tie = [straightHigh]; }
    else if (groups[0][1] === 3) { cat = 3; tie = [groups[0][0], groups[1][0], groups[2][0]]; }
    else if (groups[0][1] === 2 && groups[1][1] === 2) { cat = 2; tie = [groups[0][0], groups[1][0], groups[2][0]]; }
    else if (groups[0][1] === 2) { cat = 1; tie = [groups[0][0], groups[1][0], groups[2][0], groups[3][0]]; }
    else { cat = 0; tie = rs; }
    var score = cat;
    for (var t = 0; t < 5; t++) score = score * 15 + (t < tie.length ? tie[t] : 0);
    return score;
  }

  // Best 5-of-7 (also works for 5 or 6 cards).
  function evalBest(cards) {
    var n = cards.length;
    if (n === 5) return eval5(cards);
    var best = -1;
    for (var a = 0; a < n - 4; a++)
      for (var b = a + 1; b < n - 3; b++)
        for (var c = b + 1; c < n - 2; c++)
          for (var d = c + 1; d < n - 1; d++)
            for (var e = d + 1; e < n; e++) {
              var s = eval5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
              if (s > best) best = s;
            }
    return best;
  }

  var CATEGORY_NAMES = ['high card', 'one pair', 'two pair', 'three of a kind',
    'straight', 'flush', 'full house', 'four of a kind', 'straight flush'];

  function scoreCategory(score) {
    return Math.floor(score / 759375); // 15^5, ties padded to length 5
  }

  function describeHand(cards7) {
    var s = evalBest(cards7);
    return CATEGORY_NAMES[scoreCategory(s)];
  }

  function fullDeck() {
    var d = [];
    for (var r = 2; r <= 14; r++) for (var s = 0; s < 4; s++) d.push({ r: r, s: s });
    return d;
  }

  function remainingDeck(known) {
    var used = {};
    known.forEach(function (c) { used[cardKey(c)] = 1; });
    return fullDeck().filter(function (c) { return !used[cardKey(c)]; });
  }

  // ---- Exact draw odds (hypergeometric complement) ----
  function choose(n, k) {
    if (k < 0 || k > n) return 0;
    var r = 1;
    for (var i = 0; i < k; i++) r = r * (n - i) / (i + 1);
    return Math.round(r);
  }

  // outs: number of clean outs; unseen: unknown cards (47 on flop, 46 on turn).
  function outsOdds(outs, unseen) {
    var pTurn = outs / unseen;
    var pRiverAfterMiss = outs / (unseen - 1);
    var pBoth = 1 - choose(unseen - outs, 2) / choose(unseen, 2);
    var rule2 = outs * 0.02;
    var rule4 = outs * 0.04;
    return {
      turn: pTurn,
      riverAfterMiss: pRiverAfterMiss,
      either: pBoth,
      rule2: rule2,
      rule4: rule4,
      rule2Error: rule2 - pRiverAfterMiss,   // rule of 2 is usually quoted per street after the turn card context
      rule4Error: rule4 - pBoth
    };
  }

  // ---- Pot odds ----
  function potOdds(pot, betToCall) {
    var finalPot = pot + 2 * betToCall;
    var required = betToCall / finalPot;
    var ratio = pot / betToCall;
    return { required: required, finalPot: finalPot, ratio: ratio };
  }

  function breakEvenOuts(requiredEquity, unseen) {
    return Math.ceil(requiredEquity * unseen - 1e-12);
  }

  // ---- Hand vs hand equity ----
  // hero, villain: 2 cards each. board: 0, 3, 4 or 5 cards.
  // Preflop uses seeded Monte Carlo (labeled estimate); flop/turn/showdown exact enumeration.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function equityShowdown(hero, villain, board5) {
    var hs = evalBest(hero.concat(board5));
    var vs = evalBest(villain.concat(board5));
    if (hs > vs) return 1;
    if (hs < vs) return 0;
    return 0.5;
  }

  function equity(hero, villain, board, mcSamples, seed) {
    if (hero.length !== 2 || villain.length !== 2) return { error: 'need 2 hole cards each' };
    var known = hero.concat(villain, board);
    if (hasDuplicates(known)) return { error: 'duplicate cards' };
    var rem = remainingDeck(known);
    var need = 5 - board.length;
    if (need < 0) return { error: 'board too long' };
    var win = 0, tie = 0, loss = 0, total = 0, exact = true;

    if (need === 0) {
      var r0 = equityShowdown(hero, villain, board);
      if (r0 === 1) win = 1; else if (r0 === 0) loss = 1; else tie = 1;
      total = 1;
    } else if (need === 1) {
      for (var i = 0; i < rem.length; i++) {
        var r1 = equityShowdown(hero, villain, board.concat([rem[i]]));
        if (r1 === 1) win++; else if (r1 === 0) loss++; else tie++;
        total++;
      }
    } else if (need === 2) {
      for (var x = 0; x < rem.length - 1; x++)
        for (var y = x + 1; y < rem.length; y++) {
          var r2 = equityShowdown(hero, villain, board.concat([rem[x], rem[y]]));
          if (r2 === 1) win++; else if (r2 === 0) loss++; else tie++;
          total++;
        }
    } else {
      exact = false;
      var rand = mulberry32(seed == null ? 407 : seed);
      var n = mcSamples || 200000;
      for (var m = 0; m < n; m++) {
        // partial Fisher-Yates to draw 5 cards
        var idx = rem.map(function (_, ii) { return ii; });
        for (var k = 0; k < 5; k++) {
          var j2 = k + Math.floor(rand() * (idx.length - k));
          var tmp = idx[k]; idx[k] = idx[j2]; idx[j2] = tmp;
        }
        var b5 = [rem[idx[0]], rem[idx[1]], rem[idx[2]], rem[idx[3]], rem[idx[4]]];
        var r5 = equityShowdown(hero, villain, b5);
        if (r5 === 1) win++; else if (r5 === 0) loss++; else tie++;
        total++;
      }
    }
    return {
      win: win / total, tie: tie / total, loss: loss / total,
      total: total, exact: exact, need: need
    };
  }

  // Draw preset helper: classic outs by draw name (flop context, 47 unseen).
  var DRAWS = [
    { id: 'gutshot', name: 'Gutshot straight draw', outs: 4 },
    { id: 'overcards', name: 'Two overcards', outs: 6 },
    { id: 'oesd', name: 'Open-ended straight draw', outs: 8 },
    { id: 'flush', name: 'Flush draw', outs: 9 },
    { id: 'flushpair', name: 'Flush draw + pair (to set/two pair)', outs: 12 },
    { id: 'combo', name: 'Flush + open-ended straight', outs: 15 }
  ];

  var api = {
    parseCard: parseCard,
    parseCards: parseCards,
    cardName: cardName,
    hasDuplicates: hasDuplicates,
    eval5: eval5,
    evalBest: evalBest,
    describeHand: describeHand,
    scoreCategory: scoreCategory,
    CATEGORY_NAMES: CATEGORY_NAMES,
    choose: choose,
    outsOdds: outsOdds,
    potOdds: potOdds,
    breakEvenOuts: breakEvenOuts,
    equity: equity,
    mulberry32: mulberry32,
    fullDeck: fullDeck,
    remainingDeck: remainingDeck,
    DRAWS: DRAWS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RiverMath = api;
})(typeof self !== 'undefined' ? self : this);
