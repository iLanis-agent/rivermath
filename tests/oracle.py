#!/usr/bin/env python3
"""Independent oracle for RiverMath. Brute-force fractions-based implementation,
deliberately written separately from engine.js. Emits tests/expected.json."""
import json, itertools, fractions

F = fractions.Fraction
RANKS = '23456789TJQKA'
SUITS = 'cdhs'

def pc(tok):
    return (RANKS.index(tok[0].upper()) + 2, SUITS.index(tok[1].lower()))

def cards(s):
    toks = s.replace(',', ' ').split()
    return [pc(t) for t in toks]

def eval5(c5):
    rs = sorted((r for r, s in c5), reverse=True)
    flush = len({s for r, s in c5}) == 1
    uniq = sorted(set(rs), reverse=True)
    sh = 0
    if len(uniq) == 5:
        if uniq[0] - uniq[4] == 4:
            sh = uniq[0]
        elif uniq == [14, 5, 4, 3, 2]:
            sh = 5
    cnt = {}
    for r in rs:
        cnt[r] = cnt.get(r, 0) + 1
    groups = sorted(cnt.items(), key=lambda kv: (kv[1], kv[0]), reverse=True)
    if flush and sh: cat, tie = 8, [sh]
    elif groups[0][1] == 4: cat, tie = 7, [groups[0][0], groups[1][0]]
    elif groups[0][1] == 3 and groups[1][1] == 2: cat, tie = 6, [groups[0][0], groups[1][0]]
    elif flush: cat, tie = 5, rs
    elif sh: cat, tie = 4, [sh]
    elif groups[0][1] == 3: cat, tie = 3, [groups[0][0], groups[1][0], groups[2][0]]
    elif groups[0][1] == 2 and groups[1][1] == 2: cat, tie = 2, [groups[0][0], groups[1][0], groups[2][0]]
    elif groups[0][1] == 2: cat, tie = 1, [groups[0][0], groups[1][0], groups[2][0], groups[3][0]]
    else: cat, tie = 0, rs
    tie = (tie + [0] * 5)[:5]
    score = cat
    for t in tie:
        score = score * 15 + t
    return score

def eval_best(cs):
    return max(eval5(list(c)) for c in itertools.combinations(cs, 5))

def showdown(hero, vill, b5):
    h, v = eval_best(hero + b5), eval_best(vill + b5)
    return 1 if h > v else (0 if h < v else F(1, 2))

def equity(hero_s, vill_s, board_s):
    hero, vill, board = cards(hero_s), cards(vill_s), cards(board_s)
    known = set(hero + vill + board)
    rem = [(r, s) for r in range(2, 15) for s in range(4) if (r, s) not in known]
    need = 5 - len(board)
    win = tie = F(0); total = 0
    for extra in itertools.combinations(rem, need):
        res = showdown(hero, vill, board + list(extra))
        if res == 1: win += 1
        elif res == F(1, 2): tie += 1
        total += 1
    return {'win': float(win / total), 'tie': float(tie / total),
            'loss': float(1 - win / total - tie / total), 'total': total}

def outs(outs_n, unseen):
    miss2 = F(unseen - outs_n, 1) * F(unseen - outs_n - 1, 1) / (F(unseen, 1) * F(unseen - 1, 1))
    return {
        'turn': float(F(outs_n, unseen)),
        'riverAfterMiss': float(F(outs_n, unseen - 1)),
        'either': float(1 - miss2),
        'rule2': outs_n * 0.02,
        'rule4': outs_n * 0.04,
    }

def pot(pot_size, bet):
    return {'required': float(F(bet, pot_size + 2 * bet)), 'finalPot': pot_size + 2 * bet,
            'ratio': float(F(pot_size, bet))}

out = {'outs': {}, 'pot': {}, 'eval_categories': {}, 'equity': {}}

for o, u in [(4, 47), (6, 47), (8, 47), (9, 47), (12, 47), (15, 47), (9, 46), (2, 46), (20, 47), (1, 46)]:
    out['outs'][f'{o}/{u}'] = outs(o, u)

for p, b in [(100, 25), (200, 100), (40, 10), (1000, 500), (75, 75), (90, 30)]:
    out['pot'][f'{p}/{b}'] = pot(p, b)

CAT = ['high card', 'one pair', 'two pair', 'three of a kind', 'straight', 'flush',
       'full house', 'four of a kind', 'straight flush']
for name, hand in [
    ('royal', 'As Ks Qs Js Ts'),
    ('wheel', 'Ad 2c 3h 4s 5d'),
    ('quads', 'Ac Ad Ah As Kd'),
    ('boat', 'Ac Ad Ah Ks Kd'),
    ('flush7', 'As Qs 9s 6s 3s'),
    ('straight9', '9d 8c 7h 6s 5d'),
    ('trips', 'Qc Qd Qh 9s 2d'),
    ('twopair', 'Jc Jd 8h 8s Ad'),
    ('pair', 'Tc Td 9h 6s 3d'),
    ('high', 'Ac Qd 9h 6s 3d'),
]:
    score = eval5(cards(hand))
    cat = score // (15 ** 5)
    out['eval_categories'][name] = CAT[cat]

out['equity']['flushdraw_vs_pair_flop'] = equity('Ah Kh', '2c 2d', 'Qs Js 4d')
out['equity']['aa_vs_kk_flop'] = equity('Ac Ad', 'Kc Kd', '2s 7h 9c')
out['equity']['ak_vs_pair_turn'] = equity('Ah Kh', '2c 2d', 'Qs Js 4d 5c')
out['equity']['monster_vs_overpair_flop'] = equity('As Ks', 'Qh Qd', 'Ts Js 2s')
out['equity']['showdown_board_straightflush_tie'] = equity('As 2d', 'Kd Qh', '5c 6c 7c 8c 9c')
out['equity']['showdown_flush_vs_set'] = equity('Ac Tc', '9h 9d', 'Kc 7c 2c 9s 3d')

with open('tests/expected.json', 'w') as f:
    json.dump(out, f, indent=1)
print('oracle wrote expected.json')
for k, v in out['equity'].items():
    print(k, round(v['win'], 4), round(v['tie'], 4), round(v['loss'], 4), 'n=', v['total'])
