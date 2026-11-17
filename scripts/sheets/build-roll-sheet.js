const {
  ApplicationV2,
  HandlebarsApplicationMixin
} = foundry.applications.api;


export class BuildRollSheet extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "awake-build-roll",
    classes: ["awake", "awake-build-roll-sheet"],

    position: {
      width: 420
    }
  };


  static PARTS = {
    form: {
      template: "systems/awake-dryh/templates/sheets/build-roll-sheet.hbs"
    }
  };


  constructor({ actor, painRating }, options = {}) {
    super(options);

    this.actor = actor;
    this.painRating = painRating;
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
    const context = await super._prepareContext(options);

    context.actorName = this.actor.name;

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
}


export async function openBuildRollSheet({
  actorUuid,
  painRating
}) {
  const actor = await fromUuid(actorUuid);

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


  if (
    !Number.isInteger(painRating) ||
    painRating < 1
  ) {
    ui.notifications.error(
      game.i18n.localize(
        "AWAKE.Conflict.InvalidPain"
      )
    );

    return;
  }


  new BuildRollSheet({
    actor,
    painRating
  }).render({
    force: true
  });
}