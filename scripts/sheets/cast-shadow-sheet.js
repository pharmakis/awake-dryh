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


const POOLS = [
  "discipline",
  "exhaustion",
  "madness",
  "pain"
];


export class CastShadowSheet extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "awake-cast-shadow",

    classes: [
      "awake",
      "awake-cast-shadow-sheet"
    ],

    position: {
      width: 400
    },

    actions: {
      castShadow: this.#castShadow
    }
  };


  static PARTS = {
    form: {
      template:
        "systems/awake-dryh/templates/sheets/cast-shadow-sheet.hbs"
    }
  };


  constructor({
    messageId
  }, options = {}) {
    super(options);

    this.messageId = messageId;
  }


  get title() {
    return game.i18n.localize(
      "AWAKE.Despair.CastShadowTitle"
    );
  }


  async _prepareContext(options) {
    const context =
      await super._prepareContext(options);

    const message =
      game.messages.get(
        this.messageId
      );

    const conflict =
      message?.getFlag(
        game.system.id,
        "conflict"
      );


    context.despairAvailable =
      game.settings.get(
        game.system.id,
        "despair"
      );


    context.addTargets = [];
    context.removeTargets = [];


    if (!conflict?.pools) {
      return context;
    }


    for (const pool of POOLS) {
      const dice =
        conflict.pools[pool];


      if (dice.length > 0) {
        context.addTargets.push({
          key: pool,
          label:
            game.i18n.localize(
              `AWAKE.DicePools.${pool}`
            )
        });
      }


      if (dice.includes(6)) {
        context.removeTargets.push({
          key: pool,
          label:
            game.i18n.localize(
              `AWAKE.DicePools.${pool}`
            )
        });
      }
    }


    return context;
  }


  static async #castShadow(
    event,
    target
  ) {
    if (!game.user.isGM) {
      return;
    }


    const operation =
      target.dataset.operation;

    const pool =
      target.dataset.pool;


    if (
      operation !== "add" &&
      operation !== "remove"
    ) {
      return;
    }


    if (!POOLS.includes(pool)) {
      return;
    }


    const message =
      game.messages.get(
        this.messageId
      );

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
      this.close();
      return;
    }


    const currentDespair =
      game.settings.get(
        game.system.id,
        "despair"
      );


    if (currentDespair < 1) {
      ui.notifications.warn(
        game.i18n.localize(
          "AWAKE.Despair.NoDespairAvailable"
        )
      );

      this.render({
        force: true
      });

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


    const beforeResult =
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


    if (operation === "add") {
      if (pools[pool].length === 0) {
        ui.notifications.warn(
          game.i18n.localize(
            "AWAKE.Despair.EmptyPool"
          )
        );

        return;
      }


      pools[pool].push(6);
    }


    if (operation === "remove") {
      const index =
        pools[pool].indexOf(6);


      if (index === -1) {
        ui.notifications.warn(
          game.i18n.localize(
            "AWAKE.Despair.NoSix"
          )
        );

        return;
      }


      pools[pool].splice(
        index,
        1
      );
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


    let painDominanceCreatedByDespair =
      conflict.painDominanceCreatedByDespair ??
      false;


    if (result.dominant !== "pain") {
      painDominanceCreatedByDespair =
        false;
    }

    else if (
      beforeResult.dominant !== "pain"
    ) {
      painDominanceCreatedByDespair =
        true;
    }


    const actor =
      await fromUuid(
        conflict.actorUuid
      );


    if (!actor) {
      return;
    }


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

      spentDespair:
        (conflict.spentDespair ?? 0) +
        1,

      painDominanceCreatedByDespair
    };


    await game.settings.set(
      game.system.id,
      "despair",
      currentDespair - 1
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


    this.render({
      force: true
    });
  }
}


export function openCastShadowSheet({
  messageId
}) {
  if (!game.user.isGM) {
    return;
  }


  const message =
    game.messages.get(
      messageId
    );

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


  const despairAvailable =
    game.settings.get(
      game.system.id,
      "despair"
    );


  if (despairAvailable < 1) {
    ui.notifications.warn(
      game.i18n.localize(
        "AWAKE.Despair.NoDespairAvailable"
      )
    );

    return;
  }


  new CastShadowSheet({
    messageId
  }).render({
    force: true
  });
}