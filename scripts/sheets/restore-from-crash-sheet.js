const {
  ApplicationV2,
  HandlebarsApplicationMixin
} = foundry.applications.api;


export class RestoreFromCrashSheet extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id:
      "awake-restore-from-crash",

    classes: [
      "awake",
      "awake-restore-from-crash-sheet"
    ],

    position: {
      width: 420
    },

    actions: {
      restore:
        this.#restore
    }
  };


  static PARTS = {
    form: {
      template:
        "systems/awake-dryh/templates/sheets/restore-from-crash-sheet.hbs"
    }
  };


  get title() {
    return game.i18n.localize(
      "AWAKE.Recovery.Title"
    );
  }


  async _prepareContext(options) {
    const context =
      await super._prepareContext(options);


    context.actors =
      game.actors
        .filter(
          actor =>
            actor.type === "awake"
        )
        .map(
          actor => ({
            uuid:
              actor.uuid,

            name:
              actor.name,

            recovering:
              actor.system.recovery.active
          })
        )
        .sort(
          (a, b) =>
            a.name.localeCompare(b.name)
        );


    return context;
  }


  static async #restore(
    event,
    target
  ) {
    if (!game.user.isGM) {
      return;
    }


    const actorUuid =
      this.element.querySelector(
        '[name="actorUuid"]'
      )?.value;


    if (!actorUuid) {
      ui.notifications.warn(
        game.i18n.localize(
          "AWAKE.Recovery.SelectCharacter"
        )
      );

      return;
    }


    const actor =
      await fromUuid(
        actorUuid
      );


    if (
      !actor ||
      actor.documentName !== "Actor" ||
      actor.type !== "awake"
    ) {
      return;
    }


    if (!actor.system.recovery.active) {
      ui.notifications.warn(
        game.i18n.localize(
          "AWAKE.Recovery.NotRecovering"
        )
      );

      return;
    }


    const discipline =
      actor.system.recovery
        .preCrashDiscipline;


    await actor.update({
      "system.discipline":
        discipline,

      "system.recovery.active":
        false
    });


    ui.notifications.info(
      game.i18n.format(
        "AWAKE.Recovery.Restored",
        {
          name:
            actor.name,

          discipline
        }
      )
    );


    this.render();
  }
}


export function openRestoreFromCrashSheet() {
  if (!game.user.isGM) {
    return;
  }


  new RestoreFromCrashSheet().render({
    force: true
  });
}