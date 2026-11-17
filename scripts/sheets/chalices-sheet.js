const {
  ApplicationV2,
  HandlebarsApplicationMixin
} = foundry.applications.api;


export class ChalicesSheet extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "awake-chalices",

    classes: [
      "awake",
      "awake-chalices-sheet"
    ],

    position: {
      width: 360
    },

    actions: {
      changeChalice: this.#changeChalice
    }
  };


  static PARTS = {
    form: {
      template:
        "systems/awake-dryh/templates/sheets/chalices-sheet.hbs"
    }
  };


  get title() {
    return game.i18n.localize(
      "AWAKE.Chalices.Title"
    );
  }


  async _prepareContext(options) {
    const context =
      await super._prepareContext(options);

    context.hope =
      game.settings.get(
        game.system.id,
        "hope"
      );

    context.despair =
      game.settings.get(
        game.system.id,
        "despair"
      );

    return context;
  }


  static async #changeChalice(
    event,
    target
  ) {
    if (!game.user.isGM) {
      ui.notifications.warn(
        game.i18n.localize(
          "AWAKE.Chalices.GMOnly"
        )
      );

      return;
    }


    const chalice =
      target.dataset.chalice;

    const delta =
      Number(target.dataset.delta);


    if (
      chalice !== "hope" &&
      chalice !== "despair"
    ) {
      return;
    }


    if (
      delta !== 1 &&
      delta !== -1
    ) {
      return;
    }


    const current =
      game.settings.get(
        game.system.id,
        chalice
      );


    const next =
      Math.max(
        0,
        current + delta
      );


    if (next === current) {
      return;
    }


    await game.settings.set(
      game.system.id,
      chalice,
      next
    );


    this.render({
      force: true
    });
  }
}


export function openChalicesSheet() {
  if (!game.user.isGM) {
    ui.notifications.warn(
      game.i18n.localize(
        "AWAKE.Chalices.GMOnly"
      )
    );

    return;
  }


  new ChalicesSheet().render({
    force: true
  });
}