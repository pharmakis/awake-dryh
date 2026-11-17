const DOMINANCE_PRIORITY = {
  discipline: 4,
  madness: 3,
  exhaustion: 2,
  pain: 1
};

export function countSuccesses(dice) {
  return dice.filter(value => value <= 3).length;
}

export function comparePoolStrength(a, b) {
  const aDice = [...a.dice].sort((x, y) => y - x);
  const bDice = [...b.dice].sort((x, y) => y - x);

  const length = Math.max(aDice.length, bDice.length);

  for (let i = 0; i < length; i++) {
    const aValue = aDice[i];
    const bValue = bDice[i];

    if (aValue === undefined) return -1;
    if (bValue === undefined) return 1;

    if (aValue !== bValue) {
      return aValue - bValue;
    }
  }

  return DOMINANCE_PRIORITY[a.type] - DOMINANCE_PRIORITY[b.type];
}

export function determineDominantPool(pools) {
  const nonEmptyPools = pools.filter(pool => pool.dice.length > 0);

  if (nonEmptyPools.length === 0) {
    return null;
  }

  let dominant = nonEmptyPools[0];

  for (const pool of nonEmptyPools.slice(1)) {
    if (comparePoolStrength(pool, dominant) > 0) {
      dominant = pool;
    }
  }

  return dominant;
}

export function resolveRoll({
  discipline,
  exhaustion,
  madness,
  pain,
  bonusSuccesses = 0
}) {
  const pools = [
    {
      type: "discipline",
      dice: discipline
    },
    {
      type: "exhaustion",
      dice: exhaustion
    },
    {
      type: "madness",
      dice: madness
    },
    {
      type: "pain",
      dice: pain
    }
  ];

  const playerSuccesses =
    countSuccesses(discipline) +
    countSuccesses(exhaustion) +
    countSuccesses(madness) +
    bonusSuccesses;

  const painSuccesses = countSuccesses(pain);

  const dominant = determineDominantPool(pools);

  return {
    playerSuccesses,
    painSuccesses,

    success: playerSuccesses >= painSuccesses,

    dominant: dominant?.type ?? null,

    pools: {
      discipline,
      exhaustion,
      madness,
      pain
    }
  };
}