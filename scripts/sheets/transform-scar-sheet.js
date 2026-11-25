import {
  enqueueHelpingOperation
} from "../rules/helping.js";


const {
  ApplicationV2,
  HandlebarsApplicationMixin,
  DialogV2
} = foundry.applications.api;

const HOPE_LIMIT = 5;


function getTransformTarget(actorUuid, scarIndex, user) {
  const actor =
    foundry.utils.fromUuidSync(actorUuid);

  if (
    !actor ||
    actor.type !== "awake" ||
    actor.system.discipline <= 0 ||
    !user
  ) {
    return null;
  }

  if (
    !user.isGM &&
    !actor.testUserPermission(
      user,
      CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
    )
  ) {
    return null;
  }

  if (!Number.isInteger(scarIndex)) {
    return null;
  }

  const scar =
    actor.system.scars[scarIndex];

  if (
    !scar ||
    !scar.text?.trim() ||
    scar.transformed
  ) {
    return null;
  }

  return { actor, scar };
}


function getHopePlan(actor, amounts) {
  const system = actor.system;

  const {
    exhaustion,
    fight,
    flight,
    restoreDiscipline
  } = amounts;

  if (
    ![
      exhaustion,
      fight,
      flight,
      restoreDiscipline
    ].every(value =>
      Number.isInteger(value) && value >= 0
    )
  ) {
    return null;
  }

  if (
    exhaustion > system.exhaustion ||
    fight > system.responses.fight.checked ||
    flight > system.responses.flight.checked ||
    restoreDiscipline > 1
  ) {
    return null;
  }

  if (
    restoreDiscipline &&
    (
      system.permanentMadness <= 0 ||
      system.discipline <= 0 ||
      system.recovery.active
    )
  ) {
    return null;
  }

  const restoreCost =
    5 - system.discipline;

  const cost =
    exhaustion +
    fight +
    flight +
    restoreDiscipline * restoreCost;

  if (cost < 1 || cost > HOPE_LIMIT) {
    return null;
  }

  const updates = {};

  if (exhaustion) {
    updates["system.exhaustion"] =
      system.exhaustion - exhaustion;
  }

  if (fight) {
    updates["system.responses.fight.checked"] =
      system.responses.fight.checked - fight;
  }

  if (flight) {
    updates["system.responses.flight.checked"] =
      system.responses.flight.checked - flight;
  }

  if (restoreDiscipline) {
    updates["system.discipline"] =
      system.discipline + 1;

    updates["system.permanentMadness"] =
      system.permanentMadness - 1;
  }

  return { cost, updates };
}


export class TransformScarSheet extends
  HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    classes: [
      "awake",
      "awake-transform-scar-sheet"
    ],

    tag: "form",

    position: {
      width: 420
    },

    form: {
      closeOnSubmit: false,
      submitOnChange: false,
      handler: this.#onSubmit
    },

    actions: {
      cancel: TransformScarSheet.#onCancel
    }
  };


  static PARTS = {
    form: {
      template:
        "systems/awake-dryh/templates/sheets/transform-scar-sheet.hbs"
    }
  };


  constructor({ actorUuid, scarIndex }, options = {}) {
    super(options);

    this.actorUuid = actorUuid;
    this.scarIndex = scarIndex;
  }


  get title() {
    return game.i18n.localize(
      "AWAKE.Scars.TransformTitle"
    );
  }


  async _prepareContext(options) {
    const context =
      await super._prepareContext(options);

    const target = getTransformTarget(
      this.actorUuid,
      this.scarIndex,
      game.user
    );

    context.available = Boolean(target);

    if (!target) {
      return context;
    }

    const system = target.actor.system;

    context.actorName = target.actor.name;
    context.scarText = target.scar.text;

    context.maxExhaustion =
      Math.min(HOPE_LIMIT, system.exhaustion);

    context.maxFight =
      system.responses.fight.checked;

    context.maxFlight =
      system.responses.flight.checked;

    context.restoreCost =
      5 - system.discipline;

    context.canRestoreDiscipline =
      system.permanentMadness > 0 &&
      system.discipline > 0 &&
      !system.recovery.active;

    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const budget = this.element.querySelector(
        "[data-transform-hope-budget]"
    );

    const submit = this.element.querySelector(
        'button[type="submit"]'
    );

    if (!budget || !submit) return;

    const updateBudget = () => {
        const getAmount = name =>
        Number(
            this.element.querySelector(
            `[name="${name}"]`
            )?.value ?? 0
        );

        const spent =
        getAmount("exhaustion") +
        getAmount("fight") +
        getAmount("flight") +
        getAmount("restoreDiscipline") *
            context.restoreCost;

        budget.textContent =
        `${HOPE_LIMIT - spent} / ${HOPE_LIMIT}`;

        budget.classList.toggle(
        "over-budget",
        spent > HOPE_LIMIT
        );

        submit.disabled =
        spent <= 0 || spent > HOPE_LIMIT;
    };

    for (const field of this.element.querySelectorAll(
        "input[type='number'], select"
    )) {
        field.addEventListener("input", updateBudget);
        field.addEventListener("change", updateBudget);
    }

    updateBudget();
    }


  static #onCancel() {
    return this.close();
  }


  static async #onSubmit(event, form, formData) {
    if (this._submitting) return;

    const target = getTransformTarget(
      this.actorUuid,
      this.scarIndex,
      game.user
    );

    if (!target) return;

    const amounts = {
      exhaustion:
        Number(formData.object.exhaustion ?? 0),

      fight:
        Number(formData.object.fight ?? 0),

      flight:
        Number(formData.object.flight ?? 0),

      restoreDiscipline:
        Number(formData.object.restoreDiscipline ?? 0)
    };

    const plan =
      getHopePlan(target.actor, amounts);

    if (!plan) {
      ui.notifications.warn(
        game.i18n.localize(
          "AWAKE.Scars.InvalidTransformHope"
        )
      );

      return;
    }

    const submission = {
      type: "transformScarHope",

      actorUuid: this.actorUuid,
      scarIndex: this.scarIndex,
      scarText: target.scar.text,
      userId: game.user.id,

      amounts,
      cost: plan.cost
    };

    this._submitting = true;

    try {
      if (game.user.isActiveGM) {
        const applied =
          await handleTransformScarSubmission(
            submission
          );

        if (!applied) return;
      }

      else {
        if (!game.users.activeGM) {
          ui.notifications.warn(
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

      await this.close();
    }

    finally {
      this._submitting = false;
    }
  }
}


export function openTransformScarSheet({
  actorUuid,
  scarIndex
}) {
  const target = getTransformTarget(
    actorUuid,
    scarIndex,
    game.user
  );

  if (!target) {
    ui.notifications.warn(
      game.i18n.localize(
        "AWAKE.Scars.TransformUnavailable"
      )
    );

    return;
  }

  new TransformScarSheet({
    actorUuid,
    scarIndex
  }).render({
    force: true
  });
}


function validateSubmission(submission) {
  const user =
    game.users.get(submission.userId);

  const target = getTransformTarget(
    submission.actorUuid,
    submission.scarIndex,
    user
  );

  if (
    !target ||
    target.scar.text !== submission.scarText
  ) {
    return null;
  }

  const plan =
    getHopePlan(
      target.actor,
      submission.amounts ?? {}
    );

  if (!plan || plan.cost !== submission.cost) {
    return null;
  }

  return { ...target, plan };
}


export async function handleTransformScarSubmission(
  submission
) {
  if (!game.user.isActiveGM) return false;

  const request =
    validateSubmission(submission);

  if (!request) return false;

  const content =
    document.createElement("div");

  const description =
    document.createElement("p");

  description.textContent =
    game.i18n.format(
      "AWAKE.Scars.TransformApproval",
      {
        name: request.actor.name,
        scar: request.scar.text,
        cost: request.plan.cost
      }
    );

  content.append(description);

  const effects =
    document.createElement("ul");

  const labels = {
    exhaustion: "AWAKE.Hope.ReduceExhaustion",
    fight: "AWAKE.Hope.ClearFight",
    flight: "AWAKE.Hope.ClearFlight",
    restoreDiscipline: "AWAKE.Hope.RestoreDiscipline"
  };

  for (const [key, label] of Object.entries(labels)) {
    const amount = submission.amounts[key];

    if (!amount) continue;

    const effect =
      document.createElement("li");

    effect.textContent =
      `${game.i18n.localize(label)} × ${amount}`;

    effects.append(effect);
  }

  content.append(effects);

  const approved =
    await DialogV2.confirm({
      window: {
        title: game.i18n.localize(
          "AWAKE.Scars.TransformTitle"
        )
      },

      content: content.outerHTML
    });

  if (!approved) return false;

  return enqueueHelpingOperation(
    () => applyTransformScarSubmission(submission)
  );
}


async function applyTransformScarSubmission(
  submission
) {
  if (!game.user.isActiveGM) return false;

  const request =
    validateSubmission(submission);

  if (!request) return false;

  const { actor, plan } = request;

  const scars =
    actor.system.scars.map(scar => ({
      text: scar.text,
      recalled: scar.recalled,
      transformed: scar.transformed
    }));

  scars[submission.scarIndex].transformed = true;
  scars[submission.scarIndex].recalled = false;

  await actor.update({
    ...plan.updates,

    "system.scars": scars
  });

  return true;
}