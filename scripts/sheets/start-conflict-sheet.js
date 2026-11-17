const {
  ApplicationV2,
  HandlebarsApplicationMixin
} = foundry.applications.api;


export class StartConflictSheet extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "awake-start-conflict",
    classes: ["awake-start-conflict-sheet"],
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
      template: "systems/awake-dryh/templates/sheets/start-conflict-sheet.hbs"
    }
  };


  get title() {
    return game.i18n.localize("AWAKE.Conflict.StartTitle");
  }


  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.actors = game.actors
      .filter(actor => actor.type === "awake")
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(actor => ({
        id: actor.id,
        name: actor.name
      }));

    return context;
  }


  static async #onSubmit(event, form, formData) {
    if (!game.user.isGM) {
      ui.notifications.warn(
        game.i18n.localize("AWAKE.Conflict.GMOnly")
      );

      return null;
    }

    const {
      actorId,
      pain
    } = formData.object;

    const actor = game.actors.get(actorId);
    const painRating = Number(pain);

    if (!actor || actor.type !== "awake") {
      ui.notifications.error(
        game.i18n.localize("AWAKE.Conflict.InvalidActor")
      );

      return null;
    }

    if (
      !Number.isInteger(painRating) ||
      painRating < 1
    ) {
      ui.notifications.error(
        game.i18n.localize("AWAKE.Conflict.InvalidPain")
      );

      return null;
    }

    const conflict = {
      status: "awaitingPlayer",
      actorUuid: actor.uuid,
      painRating,
      createdBy: game.user.id
    };

    const content = buildConflictMessageContent(
      actor,
      painRating
    );

    return ChatMessage.create({
      content,

      flags: {
        [game.system.id]: {
          conflict
        }
      }
    });
  }
}


export function openStartConflictSheet() {
  if (!game.user.isGM) {
    ui.notifications.warn(
      game.i18n.localize("AWAKE.Conflict.GMOnly")
    );

    return;
  }

  const hasActors = game.actors.some(
    actor => actor.type === "awake"
  );

  if (!hasActors) {
    ui.notifications.warn(
      game.i18n.localize("AWAKE.Conflict.NoActors")
    );

    return;
  }

  new StartConflictSheet().render({
    force: true
  });
}


function buildConflictMessageContent(actor, painRating) {
  const card = document.createElement("section");
  card.classList.add("awake-conflict-card");

  const title = document.createElement("h3");
  title.textContent = game.i18n.localize(
    "AWAKE.Conflict.Title"
  );

  const matchup = document.createElement("p");
  matchup.textContent = game.i18n.format(
    "AWAKE.Conflict.FacesPain",
    {
      name: actor.name,
      pain: painRating
    }
  );

  const status = document.createElement("p");
  status.classList.add("awake-conflict-status");
  status.textContent = game.i18n.localize(
    "AWAKE.Conflict.WaitingForProtagonist"
  );

  card.append(
    title,
    matchup,
    status
  );

  return card.outerHTML;
}