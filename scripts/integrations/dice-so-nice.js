const POOL_APPEARANCE = {
  discipline: {
    background: "#e8e1d1",
    foreground: "#242424"
  },

  exhaustion: {
    background: "#25252a",
    foreground: "#eee8da"
  },

  madness: {
    background: "#749b36",
    foreground: "#19230e"
  },

  pain: {
    background: "#922837",
    foreground: "#f2e7d5"
  }
};


export async function animateDiceRoll(roll) {
  if (
    !game.modules.get("dice-so-nice")?.active ||
    !game.dice3d?.showForRoll
  ) {
    return;
  }


  try {
    for (const die of roll.dice) {
      const appearance =
        POOL_APPEARANCE[die.flavor];

      if (!appearance) {
        continue;
      }

      die.options.appearance = {
        colorset: "custom",

        ...appearance,

        outline: "none",
        edge: appearance.background,
        texture: "bronze01",
        material: "metal",
        system: "standard"
      };
    }


    await game.dice3d.showForRoll(
      roll,
      game.user,
      true
    );
  }

  catch (error) {
    console.warn(
      "Awake | Dice So Nice animation failed.",
      error
    );
  }
}