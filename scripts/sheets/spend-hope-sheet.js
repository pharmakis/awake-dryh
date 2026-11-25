import {
  resolveRoll
} from "../rules/roll.js";

import {
  buildRollResultContent
} from "./build-roll-sheet.js";


const {
  ApplicationV2,
  HandlebarsApplicationMixin
} = foundry.applications.api;


export class SpendHopeSheet extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "awake-spend-hope",

    classes: [
      "awake",
      "awake-spend-hope-sheet"
    ],

    tag: "form",

    position: {
      width: 360
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
        "systems/awake-dryh/templates/sheets/spend-hope-sheet.hbs"
    }
  };


  constructor({
    messageId,
    hopeAvailable
  }, options = {}) {
    super(options);

    this.messageId = messageId;
    this.hopeAvailable = hopeAvailable;
  }


  get title() {
    return game.i18n.localize(
      "AWAKE.Hope.SpendHope"
    );
  }


  async _prepareContext(options) {
    const context =
      await super._prepareContext(options);

    context.hopeAvailable =
      this.hopeAvailable;

    return context;
  }


  static async #onSubmit(
    event,
    form,
    formData
  ) {
    const amount =
      Number(
        formData.object.amount
      );


    if (
      !Number.isInteger(amount) ||
      amount < 1
    ) {
      ui.notifications.error(
        game.i18n.localize(
          "AWAKE.Hope.InvalidAmount"
        )
      );

      return;
    }


    const submission = {
      type: "spendHope",

      messageId:
        this.messageId,

      userId:
        game.user.id,

      amount
    };


    if (game.user.isGM) {
      await handleSpendHopeSubmission(
        submission
      );

      return;
    }


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


export function openSpendHopeSheet({
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
    !conflict ||
    conflict.status !== "modifiable"
  ) {
    ui.notifications.warn(
      game.i18n.localize(
        "AWAKE.Conflict.InvalidConflict"
      )
    );

    return;
  }


  const hopeAvailable =
    game.settings.get(
      game.system.id,
      "hope"
    );


  if (hopeAvailable < 1) {
    ui.notifications.warn(
      game.i18n.localize(
        "AWAKE.Hope.NoneAvailable"
      )
    );

    return;
  }


  new SpendHopeSheet({
    messageId,
    hopeAvailable
  }).render({
    force: true
  });
}


export async function handleSpendHopeSubmission(
  submission
) {
  if (!game.user.isActiveGM) {
    return;
  }


  const {
    messageId,
    amount
  } = submission;


  if (
    !Number.isInteger(amount) ||
    amount < 1
  ) {
    return;
  }


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
    conflict.status !== "modifiable"
  ) {
    return;
  }


  const currentHope =
    game.settings.get(
      game.system.id,
      "hope"
    );


  if (amount > currentHope) {
    ui.notifications.warn(
      game.i18n.localize(
        "AWAKE.Hope.NotEnough"
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
    return;
  }


  const pools = {
    discipline:
      [...conflict.pools.discipline],

    exhaustion:
      [...conflict.pools.exhaustion],

    madness:
      [...conflict.pools.madness],

    pain:
      [...conflict.pools.pain]
  };


  for (let i = 0; i < amount; i++) {
    pools.discipline.push(1);
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
        pools.pain,

      bonusSuccesses:
        conflict.helper?.successes ?? 0
    });


  const updatedConflict = {
    ...conflict,

    pools,

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

    spentHope:
      (conflict.spentHope ?? 0) +
      amount
  };


  await game.settings.set(
    game.system.id,
    "hope",
    currentHope - amount
  );


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