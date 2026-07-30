# Tower Defense Balance Tuning

## Core Loop

The fundamental TD economy tension: **player DPS vs enemy HP pool, gated by gold income.** If gold scales too fast relative to HP, the game is trivial. If HP scales too fast relative to gold, the game is unwinnable.

## Key Constants to Tune (and their interactions)

```
ENEMY HP   = baseHP × (1 + (wave-1) × hpWaveScale)
KILL GOLD  = baseReward × (1 + (wave-1) × killWaveScale) / goldDivisor
WAVE COUNT = mobsBase + mobsGrow × wave
WAVE BONUS = flatGold per wave
```

**Critical interaction:** `killWaveScale` and `hpWaveScale` must be tuned together. If kill rewards grow 10× faster than HP, the player buys every tower by wave 20 and nothing threatens them. If HP grows faster than kill rewards, the player can't afford enough DPS.

## Starting Point (tested values)

| Constant | Value | Notes |
|----------|-------|-------|
| `hpWaveScale` | 0.20 | 1× at wave 1, 3× at wave 11, ~11× at wave 50 |
| `killWaveScale` | 0.15 | Gentler than HP — player must make strategic buys |
| `goldDivisor` | ~1.67 (÷5 × 3) | Tune this for income pace |
| `mobsBase` | 4 | First wave is 4 enemies |
| `mobsGrow` | 0.5 | +1 enemy every 2 waves |
| `startMoney` | 132 | Enough for ~5 cheap towers or 1-2 medium |
| `waveBonus` | 15 | Flat bonus after each wave |

## Common Balance Failures

### Too Easy (player goes to wave 150 without threat)
- `killWaveScale` is too high relative to `hpWaveScale`
- `mobsGrow` is too low — fewer enemies than towers can handle
- Boss HP doesn't scale — 300 HP boss at wave 5 is same at wave 50
- Gold divisor too small (generous income)

### Too Hard (unwinnable past wave X)
- `hpWaveScale` is too high relative to `killWaveScale`
- `mobsBase` is too large — first wave impossible with starting money
- `waveBonus` is too small — can't recover from mistakes
- Tower costs relative to income make the first few waves impossible

### Spiky Difficulty (easy then suddenly impossible)
- No HP scaling → all waves are the same until the spawn count overwhelms
- Fixed boss HP with no wave scaling → boss is threat at wave 5, joke at wave 20
- No enemy type variety in later waves → player trivializes with one tower type

## Binary Search for Balance

If the player says "wave X is too hard" or "wave X is too easy":

1. Calculate total enemy HP pool for wave X
2. Calculate affordable tower DPS from cumulative gold through wave X-1
3. If DPS < HP pool → increase gold or decrease HP scale
4. If DPS > 2× HP pool → decrease gold or increase HP scale
5. Test one wave before and after X to confirm it's not a spike

## Wave Composition Scaling

Enemies should get harder, not just more numerous. Options:
- Unlock stronger enemy types at higher waves (e.g. min(defIdx, floor(wave/3)))
- Scale enemy speed slightly (makes path length feel shorter)
- Bosses should have wave-scaled HP
- Mix mob types so no single tower counters everything