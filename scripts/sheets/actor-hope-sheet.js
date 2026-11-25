function getHopeActions(actor) {
  const system = actor.system;

  const hope = game.settings.get(
    game.system.id,
    "hope"
  );

  const restoreCost =
    5 - system.discipline;

  return [
    {
      id: "reduceExhaustion",
      label: "AWAKE.Hope.ReduceExhaustion",
      cost: 1,
      available:
        hope >= 1 &&
        system.exhaustion > 0
    },
    {
      id: "clearFight",
      label: "AWAKE.Hope.ClearFight",
      cost: 1,
      available:
        hope >= 1 &&
        system.responses.fight.checked > 0
    },
    {
      id: "clearFlight",
      label: "AWAKE.Hope.ClearFlight",
      cost: 1,
      available:
        hope >= 1 &&
        system.responses.flight.checked > 0
    },
    {
      id: "restoreDiscipline",
      label: "AWAKE.Hope.RestoreDiscipline",
      cost: restoreCost,
      available:
        hope >= restoreCost &&
        system.permanentMadness > 0 &&
        system.discipline > 0 &&
        !system.recovery.active
    }
  ];
}

export class ActorHopeSheet extends
  foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2
  ) {

  static DEFAULT_OPTIONS = {
    classes: [
      "awake",
      "awake-actor-hope-sheet"
    ],

    position: {
      width: 320,
      height: "auto"
    },

    window: {
      title: "AWAKE.Hope.SpendHope",
      resizable: false
    },

    actions: {
         spend: ActorHopeSheet.#onSpend
    }
  };


  static PARTS = {
    main: {
      template:
        "systems/awake-dryh/templates/sheets/actor-hope-sheet.hbs"
    }
  };


  constructor(actor, options = {}) {
    super(options);

    this.actor = actor;
  }


  async _prepareContext(options) {
    const context =
      await super._prepareContext(options);

    context.hope = game.settings.get(
      game.system.id,
      "hope"
    );

    context.hopeActions =
      getHopeActions(this.actor);

    return context;
  }

  static async #onSpend(event, target) {
    if (this._spendingHope) return;

    const action = target.dataset.hopeAction;

    const option = getHopeActions(
        this.actor
    ).find(option => option.id === action);

    if (!option?.available) {
        ui.notifications.warn(
        game.i18n.localize(
            "AWAKE.Hope.ActionUnavailable"
        )
        );

        await this.render();
        return;
    }

    const submission = {
        type: "spendActorHope",
        actorUuid: this.actor.uuid,
        userId: game.user.id,
        action
    };

    this._spendingHope = true;

    try {
        if (game.users.activeGM?.id === game.user.id) {
        const applied =
            await handleActorHopeSubmission(
            submission
            );

        if (!applied) {
            await this.render();
            return;
        }
        }
        else {
        if (!game.users.activeGM) {
            ui.notifications.warn(
            game.i18n.localize(
                "AWAKE.Hope.NoActiveGM"
            )
            );

            return;
        }

        game.socket.emit(
            `system.${game.system.id}`,
            submission
        );
        }

        await this.close();
    }
    finally {
        this._spendingHope = false;
    }
  }
}
let actorHopeQueue = Promise.resolve();

export function handleActorHopeSubmission(submission) {
  const request = actorHopeQueue.then(
    () => applyActorHope(submission)
  );

  actorHopeQueue = request.catch(error => {
    console.error(error);
  });

  return request;
}


async function applyActorHope(submission) {
  if (game.users.activeGM?.id !== game.user.id) {
    return false;
  }

  const actor = await fromUuid(
    submission.actorUuid
  );

  const user = game.users.get(
    submission.userId
  );

  if (
    !actor ||
    actor.documentName !== "Actor" ||
    actor.type !== "awake" ||
    !user
  ) {
    return false;
  }

  if (
    !user.isGM &&
    !actor.testUserPermission(user, "OWNER")
  ) {
    return false;
  }

  if (actor.system.discipline === 0) {
    return false;
  }

  const option = getHopeActions(actor).find(
    option => option.id === submission.action
  );

  if (!option?.available) {
    ui.notifications.warn(
      game.i18n.localize(
        "AWAKE.Hope.ActionUnavailable"
      )
    );

    return false;
  }

  const system = actor.system;

  let updates = {};

  switch (option.id) {
    case "reduceExhaustion":
      updates = {
        "system.exhaustion":
          system.exhaustion - 1
      };
      break;

    case "clearFight":
      updates = {
        "system.responses.fight.checked":
          system.responses.fight.checked - 1
      };
      break;

    case "clearFlight":
      updates = {
        "system.responses.flight.checked":
          system.responses.flight.checked - 1
      };
      break;

    case "restoreDiscipline":
      updates = {
        "system.discipline":
          system.discipline + 1,

        "system.permanentMadness":
          system.permanentMadness - 1
      };
      break;

    default:
      return false;
  }

  const hope = game.settings.get(
    game.system.id,
    "hope"
  );

  if (hope < option.cost) {
    ui.notifications.warn(
      game.i18n.localize(
        "AWAKE.Hope.NotEnough"
      )
    );

    return false;
  }

  await game.settings.set(
    game.system.id,
    "hope",
    hope - option.cost
  );

  try {
    await actor.update(updates);
  }
  catch (error) {
    const currentHope = game.settings.get(
      game.system.id,
      "hope"
    );

    await game.settings.set(
      game.system.id,
      "hope",
      currentHope + option.cost
    );

    throw error;
  }

  return true;
}