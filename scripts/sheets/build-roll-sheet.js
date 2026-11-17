import {
  resolveRoll
} from "../rules/roll.js";


const {
  ApplicationV2,
  HandlebarsApplicationMixin
} = foundry.applications.api;


export class BuildRollSheet extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "awake-build-roll",

    classes: [
      "awake",
      "awake-build-roll-sheet"
    ],

    tag: "form",

    position: {
      width: 420
    },

    form: {
      closeOnSubmit: true,
      submitOnChange: false,
      handler: this.#onSubmit
    }
  };


  static PARTS = {
    form: {
      template:
        "systems/awake-dryh/templates/sheets/build-roll-sheet.hbs"
    }
  };


  constructor({
    actor,
    painRating,
    messageId
  }, options = {}) {
    super(options);

    this.actor = actor;
    this.painRating = painRating;
    this.messageId = messageId;
  }


  get title() {
    return game.i18n.format(
      "AWAKE.Conflict.BuildRollTitle",
      {
        name: this.actor.name
      }
    );
  }


  async _prepareContext(options) {
    const context =
      await super._prepareContext(options);

    context.actorName =
      this.actor.name;

    context.discipline =
      this.actor.system.discipline;

    context.exhaustion =
      this.actor.system.exhaustion;

    context.permanentMadness =
      this.actor.system.permanentMadness;

    context.painRating =
      this.painRating;

    context.canIncreaseExhaustion =
      this.actor.system.exhaustion < 6;

    return context;
  }


  static async #onSubmit(
    event,
    form,
    formData
  ) {
    const message =
      game.messages.get(this.messageId);

    const conflict =
      message?.getFlag(
        game.system.id,
        "conflict"
      );


    if (
      !message ||
      !conflict ||
      conflict.status !== "awaitingPlayer"
    ) {
      ui.notifications.error(
        game.i18n.localize(
          "AWAKE.Conflict.InvalidConflict"
        )
      );

      return;
    }


    const canBuildRoll =
      game.user.isGM ||
      this.actor.testUserPermission(
        game.user,
        CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
      );


    if (!canBuildRoll) {
      ui.notifications.warn(
        game.i18n.localize(
          "AWAKE.Conflict.NotYourProtagonist"
        )
      );

      return;
    }


    const temporaryMadness =
      Number(
        formData.object.temporaryMadness
      );


    const increaseExhaustion =
      formData.object.increaseExhaustion === true ||
      formData.object.increaseExhaustion === "on";


    if (
      !Number.isInteger(temporaryMadness) ||
      temporaryMadness < 0 ||
      temporaryMadness > 6
    ) {
      ui.notifications.error(
        game.i18n.localize(
          "AWAKE.Conflict.InvalidTemporaryMadness"
        )
      );

      return;
    }


    const disciplineRating =
      this.actor.system.discipline;

    const currentExhaustion =
      this.actor.system.exhaustion;

    const permanentMadnessRating =
      this.actor.system.permanentMadness;


    if (
      increaseExhaustion &&
      currentExhaustion >= 6
    ) {
      ui.notifications.error(
        game.i18n.localize(
          "AWAKE.Conflict.CannotIncreaseExhaustion"
        )
      );

      return;
    }


    const exhaustionRating =
      currentExhaustion +
      (increaseExhaustion ? 1 : 0);


    const madnessRating =
      permanentMadnessRating +
      temporaryMadness;


    /*
     * The player who pressed Roll actually rolls
     * all four pools on their own client.
     */
    const pools =
      await rollConflictPools({
        discipline:
          disciplineRating,

        exhaustion:
          exhaustionRating,

        madness:
          madnessRating,

        pain:
          conflict.painRating
      });


    const submission = {
      type: "submitConflictRoll",

      messageId:
        this.messageId,

      userId:
        game.user.id,

      temporaryMadness,

      increaseExhaustion,

      pools
    };


    /*
     * If the person rolling is the GM,
     * no socket round-trip is necessary.
     */
    if (game.user.isGM) {
      await handleConflictRollSubmission(
        submission
      );

      return;
    }


    /*
     * A player needs an active GM because
     * the conflict ChatMessage belongs to the GM.
     */
    if (!game.users.activeGM) {
      ui.notifications.error(
        game.i18n.localize(
          "AWAKE.Conflict.NoActiveGM"
        )
      );

      return;
    }


    game.socket.emit(
      `system.${game.system.id}`,
      submission
    );
  }
}


export async function openBuildRollSheet({
  messageId
}) {
  const message =
    game.messages.get(messageId);


  const conflict =
    message?.getFlag(
      game.system.id,
      "conflict"
    );


  if (
    !message ||
    !conflict
  ) {
    ui.notifications.error(
      game.i18n.localize(
        "AWAKE.Conflict.InvalidConflict"
      )
    );

    return;
  }


  if (
    conflict.status !== "awaitingPlayer"
  ) {
    ui.notifications.warn(
      game.i18n.localize(
        "AWAKE.Conflict.AlreadyRolled"
      )
    );

    return;
  }


  const actor =
    await fromUuid(
      conflict.actorUuid
    );


  if (
    !actor ||
    actor.documentName !== "Actor" ||
    actor.type !== "awake"
  ) {
    ui.notifications.error(
      game.i18n.localize(
        "AWAKE.Conflict.InvalidActor"
      )
    );

    return;
  }


  const canBuildRoll =
    game.user.isGM ||
    actor.testUserPermission(
      game.user,
      CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
    );


  if (!canBuildRoll) {
    ui.notifications.warn(
      game.i18n.localize(
        "AWAKE.Conflict.NotYourProtagonist"
      )
    );

    return;
  }


  new BuildRollSheet({
    actor,

    painRating:
      conflict.painRating,

    messageId
  }).render({
    force: true
  });
}


export async function handleConflictRollSubmission(
  submission
) {
  /*
   * Only the active GM applies the submitted roll
   * to the shared conflict.
   */
  if (!game.user.isActiveGM) {
    return;
  }


  const {
    messageId,
    userId,
    temporaryMadness,
    increaseExhaustion,
    pools
  } = submission;


  const message =
    game.messages.get(messageId);


  const conflict =
    message?.getFlag(
      game.system.id,
      "conflict"
    );


  if (
    !message ||
    !conflict ||
    conflict.status !== "awaitingPlayer"
  ) {
    return;
  }


  const actor =
    await fromUuid(
      conflict.actorUuid
    );


  if (
    !actor ||
    actor.documentName !== "Actor" ||
    actor.type !== "awake"
  ) {
    return;
  }


  const user =
    game.users.get(userId);


  if (!user) {
    return;
  }


  /*
   * Validate that the person who sent the roll
   * is actually allowed to roll for this Actor.
   */
  const canBuildRoll =
    user.isGM ||
    actor.testUserPermission(
      user,
      CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
    );


  if (!canBuildRoll) {
    return;
  }


  if (
    !Number.isInteger(temporaryMadness) ||
    temporaryMadness < 0 ||
    temporaryMadness > 6
  ) {
    return;
  }


  const disciplineRating =
    actor.system.discipline;

  const currentExhaustion =
    actor.system.exhaustion;

  const permanentMadnessRating =
    actor.system.permanentMadness;


  if (
    increaseExhaustion &&
    currentExhaustion >= 6
  ) {
    return;
  }


  const expectedExhaustion =
    currentExhaustion +
    (increaseExhaustion ? 1 : 0);


  const expectedMadness =
    permanentMadnessRating +
    temporaryMadness;


  /*
   * The GM does not reroll anything.
   *
   * We only verify that the submitted arrays have
   * exactly the sizes the Actor and conflict require.
   */
  if (
    !validateDicePool(
      pools?.discipline,
      disciplineRating
    ) ||
    !validateDicePool(
      pools?.exhaustion,
      expectedExhaustion
    ) ||
    !validateDicePool(
      pools?.madness,
      expectedMadness
    ) ||
    !validateDicePool(
      pools?.pain,
      conflict.painRating
    )
  ) {
    return;
  }


  const result =
    resolveRoll({
      discipline:
        pools.discipline,

      exhaustion:
        pools.exhaustion,

      madness:
        pools.madness,

      pain:
        pools.pain
    });


  /*
   * Voluntary Exhaustion is persistent,
   * so now that the submitted roll is validated,
   * apply it to the Actor.
   */
  if (increaseExhaustion) {
    await actor.update({
      "system.exhaustion":
        expectedExhaustion
    });
  }


  const updatedConflict = {
    ...conflict,

    status:
      "modifiable",

    pools: {
      discipline:
        [...pools.discipline],

      exhaustion:
        [...pools.exhaustion],

      madness:
        [...pools.madness],

      pain:
        [...pools.pain]
    },

    result: {
      playerSuccesses:
        result.playerSuccesses,

      painSuccesses:
        result.painSuccesses,

      success:
        result.success,

      dominant:
        result.dominant
    },

    temporaryMadness,

    voluntaryExhaustionIncrease:
      increaseExhaustion,

    spentHope: 0,

    spentDespair: 0,

    painDominanceCreatedByDespair:
      false,

    rolledBy:
      user.id
  };


  const content =
    buildRollResultContent(
      actor,
      conflict.painRating,
      result
    );


  await message.update({
    content,

    [`flags.${game.system.id}.conflict`]:
      updatedConflict
  });
}


async function rollConflictPools({
  discipline,
  exhaustion,
  madness,
  pain
}) {
  const parts = [];


  if (discipline > 0) {
    parts.push(
      `${discipline}d6[discipline]`
    );
  }


  if (exhaustion > 0) {
    parts.push(
      `${exhaustion}d6[exhaustion]`
    );
  }


  if (madness > 0) {
    parts.push(
      `${madness}d6[madness]`
    );
  }


  if (pain > 0) {
    parts.push(
      `${pain}d6[pain]`
    );
  }


  const formula =
    parts.join(" + ");


  const roll =
    await new foundry.dice.Roll(
      formula
    ).evaluate({
      allowInteractive: false
    });


  const pools = {
    discipline: [],
    exhaustion: [],
    madness: [],
    pain: []
  };


  for (const die of roll.dice) {
    const poolName =
      die.flavor;


    if (
      poolName === "discipline" ||
      poolName === "exhaustion" ||
      poolName === "madness" ||
      poolName === "pain"
    ) {
      pools[poolName] =
        [...die.values];
    }
  }


  return pools;
}


function validateDicePool(
  dice,
  expectedLength
) {
  if (!Array.isArray(dice)) {
    return false;
  }


  if (
    dice.length !== expectedLength
  ) {
    return false;
  }


  for (const value of dice) {
    if (
      !Number.isInteger(value) ||
      value < 1 ||
      value > 6
    ) {
      return false;
    }
  }


  return true;
}


export function buildRollResultContent(
  actor,
  painRating,
  result
) {
  const card =
    document.createElement(
      "section"
    );


  card.classList.add(
    "awake-conflict-card",
    "awake-conflict-roll"
  );


  const title =
    document.createElement("h3");


  title.textContent =
    game.i18n.localize(
      "AWAKE.Conflict.Title"
    );


  const matchup =
    document.createElement("p");


  matchup.textContent =
    game.i18n.format(
      "AWAKE.Conflict.FacesPain",
      {
        name:
          actor.name,

        pain:
          painRating
      }
    );


  card.append(
    title,
    matchup
  );


  appendPool(
    card,
    game.i18n.localize(
      "AWAKE.Actor.Discipline"
    ),
    result.pools.discipline
  );


  appendPool(
    card,
    game.i18n.localize(
      "AWAKE.Actor.Exhaustion"
    ),
    result.pools.exhaustion
  );


  appendPool(
    card,
    game.i18n.localize(
      "AWAKE.Conflict.Madness"
    ),
    result.pools.madness
  );


  appendPool(
    card,
    game.i18n.localize(
      "AWAKE.Conflict.Pain"
    ),
    result.pools.pain
  );


  const degree =
    document.createElement("p");


  degree.textContent =
    game.i18n.format(
      "AWAKE.Conflict.Degrees",
      {
        player:
          result.playerSuccesses,

        pain:
          result.painSuccesses
      }
    );


  const outcome =
    document.createElement("p");


  outcome.textContent =
    result.success
      ? game.i18n.localize(
          "AWAKE.Conflict.Success"
        )
      : game.i18n.localize(
          "AWAKE.Conflict.Failure"
        );


  const dominant =
    document.createElement("p");


  dominant.textContent =
    game.i18n.format(
      "AWAKE.Conflict.Dominant",
      {
        pool:
          getPoolLabel(
            result.dominant
          )
      }
    );


  const status =
    document.createElement("p");


  status.classList.add(
    "awake-conflict-status"
  );


  status.textContent =
    game.i18n.localize(
      "AWAKE.Conflict.Modifiable"
    );


  card.append(
    degree,
    outcome,
    dominant,
    status
  );


  return card.outerHTML;
}


function appendPool(
  card,
  label,
  dice
) {
  const row =
    document.createElement("p");


  const values =
    dice.length > 0
      ? dice.join(", ")
      : "—";


  row.textContent =
    `${label}: ${values}`;


  card.append(row);
}


function getPoolLabel(
  pool
) {
  switch (pool) {
    case "discipline":
      return game.i18n.localize(
        "AWAKE.Actor.Discipline"
      );

    case "exhaustion":
      return game.i18n.localize(
        "AWAKE.Actor.Exhaustion"
      );

    case "madness":
      return game.i18n.localize(
        "AWAKE.Conflict.Madness"
      );

    case "pain":
      return game.i18n.localize(
        "AWAKE.Conflict.Pain"
      );

    default:
      return "—";
  }
}