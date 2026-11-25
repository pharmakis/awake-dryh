import {
  enqueueHelpingOperation
} from "../rules/helping.js";
import { resolveRoll } from "../rules/roll.js";
import { buildRollResultContent } from "./build-roll-sheet.js";


const {
  ApplicationV2,
  HandlebarsApplicationMixin,
  DialogV2
} = foundry.applications.api;

const HOPE_LIMIT = 5;

const TALENT_EFFECTS = new Map([
  [
    "madnessTalent",
    "AWAKE.Scars.TransformMadnessTalent"
  ],
  [
    "exhaustionTalent",
    "AWAKE.Scars.TransformExhaustionTalent"
  ]
]);

function getTransformTarget(actorUuid, scarIndex, user, messageId = null) {
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
    let message = null;
    let conflict = null;
    let protagonist = null;

    if (messageId !== null) {
        message = game.messages.get(messageId);

        conflict = message?.getFlag(
        game.system.id,
        "conflict"
        );

        if (
        conflict?.status !== "modifiable" ||
        !conflict.pools
        ) return null;

        if (
        actorUuid !== conflict.actorUuid &&
        actorUuid !== conflict.helper?.actorUuid
        ) return null;

        protagonist = foundry.utils.fromUuidSync(
        conflict.actorUuid
        );

        if (!protagonist || protagonist.type !== "awake") {
        return null;
        }
    }

    const scars = actor.system.scars
        .map((scar, index) => ({
        index,
        text: scar.text,
        transformed: scar.transformed
        }))
        .filter(scar =>
        scar.text?.trim() && !scar.transformed
        );

    const scar = scarIndex == null
        ? scars[0]
        : scars.find(scar => scar.index === scarIndex);

    if (!scar) return null;

    return {
        actor,
        scar,
        scars,
        message,
        conflict,
        protagonist
    };
  }
}

export function getTransformScarTargets(messageId, user) {
  const conflict = game.messages
    .get(messageId)
    ?.getFlag(game.system.id, "conflict");

  if (conflict?.status !== "modifiable") {
    return [];
  }

  return [
    conflict.actorUuid,
    conflict.helper?.actorUuid
  ]
    .filter(Boolean)
    .map(actorUuid =>
      getTransformTarget(
        actorUuid,
        null,
        user,
        messageId
      )
    )
    .filter(Boolean);
}

function getHopePlan(actor, amounts, conflict = null) {
  const system = actor.system;

  const {
    exhaustion,
    fight,
    flight,
    restoreDiscipline,
    improveSuccess = 0
  } = amounts;

  if (
    ![
        exhaustion,
        fight,
        flight,
        restoreDiscipline,
        improveSuccess
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
        restoreDiscipline > 1 ||
        (improveSuccess > 0 && !conflict)
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
    restoreDiscipline * restoreCost +
    improveSuccess;

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

function getTransformPlan(actor, effect, amounts, conflict = null) {
  if (effect === "hope") {
    return getHopePlan(actor, amounts, conflict);
  }

  if (TALENT_EFFECTS.has(effect)) {
    return {
      cost: 0,
      updates: {}
    };
  }

  return null;
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


  constructor({
        actorUuid,
        scarIndex = null,
        messageId = null
    }, options = {}) {
        super(options);

        this.actorUuid = actorUuid;
        this.scarIndex = scarIndex;
        this.messageId = messageId;
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
        game.user,
        this.messageId
    );

    context.available = Boolean(target);

    if (!target) {
      return context;
    }

    const system = target.actor.system;

    context.actorName = target.actor.name;
    context.scarText = target.scar.text;
    context.inConflict = Boolean(target.conflict);
    context.scars = target.scars;

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

  const effect = this.element.querySelector(
    '[name="effect"]'
  );

  const hopeFields = this.element.querySelector(
    "[data-transform-hope-fields]"
  );

  const talentNote = this.element.querySelector(
    "[data-transform-talent-note]"
  );

  const submit = this.element.querySelector(
    'button[type="submit"]'
  );

  if (
    !budget ||
    !effect ||
    !hopeFields ||
    !talentNote ||
    !submit
  ) {
    return;
  }

  const updateForm = () => {
    const isHope = effect.value === "hope";

    hopeFields.hidden = !isHope;
    hopeFields.disabled = !isHope;
    talentNote.hidden = isHope;

    if (!isHope) {
      submit.disabled =
        !TALENT_EFFECTS.has(effect.value);

      return;
    }

    const getAmount = name =>
      Number(
        this.element.querySelector(
          `[name="${name}"]`
        )?.value ?? 0
      );

    const spent =
      getAmount("improveSuccess") +
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
      !Number.isFinite(spent) ||
      spent <= 0 ||
      spent > HOPE_LIMIT;
  };

  for (const field of this.element.querySelectorAll(
    "input[type='number'], select"
  )) {
    field.addEventListener("input", updateForm);
    field.addEventListener("change", updateForm);
  }

  updateForm();
}


  static #onCancel() {
    return this.close();
  }


  static async #onSubmit(event, form, formData) {
    if (this._submitting) return;

    const scarIndex = this.messageId === null
        ? this.scarIndex
        : Number(formData.object.scarIndex);

    if (!Number.isInteger(scarIndex)) return;

    const target = getTransformTarget(
        this.actorUuid,
        scarIndex,
        game.user,
        this.messageId
    );

    if (!target) return;

    const effect = formData.object.effect;

    const amounts = {
      improveSuccess:
        Number(formData.object.improveSuccess ?? 0),

      exhaustion:
        Number(formData.object.exhaustion ?? 0),

      fight:
        Number(formData.object.fight ?? 0),

      flight:
        Number(formData.object.flight ?? 0),

      restoreDiscipline:
        Number(formData.object.restoreDiscipline ?? 0)
    };

    const plan = getTransformPlan(
        target.actor,
        effect,
        amounts,
        target.conflict
    );

    if (!plan) {
      ui.notifications.warn(
        game.i18n.localize(
          "AWAKE.Scars.InvalidTransformHope"
        )
      );

      return;
    }

    const submission = {
      type: "transformScar",
            effect,

      actorUuid: this.actorUuid,
      scarIndex,
      messageId: this.messageId,
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
  scarIndex = null,
  messageId = null
}) {
  const target = getTransformTarget(
    actorUuid,
    scarIndex,
    game.user,
    messageId
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
    scarIndex,
    messageId
  }).render({
    force: true
  });
}


function validateSubmission(submission) {
  if (!Number.isInteger(submission.scarIndex)) {
    return null;
  }

  const user =
    game.users.get(submission.userId);

  const target = getTransformTarget(
    submission.actorUuid,
    submission.scarIndex,
    user,
    submission.messageId ?? null
  );

  if (
    !target ||
    target.scar.text !== submission.scarText
  ) {
    return null;
  }

  const plan = getTransformPlan(
    target.actor,
    submission.effect,
    submission.amounts ?? {},
    target.conflict
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

  if (submission.effect === "hope") {
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
        improveSuccess: "AWAKE.Scars.ImproveSuccess",
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
    }

    else {
    description.textContent =
        game.i18n.format(
        "AWAKE.Scars.TransformTalentApproval",
        {
            name: request.actor.name,
            scar: request.scar.text,
            effect: game.i18n.localize(
            TALENT_EFFECTS.get(submission.effect)
            )
        }
        );

    content.append(description);
    }

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

  const {
        actor,
        plan,
        message,
        conflict,
        protagonist
    } = request;

    let conflictUpdate = null;

    if (conflict && submission.effect === "hope") {
        const amount =
            submission.amounts.improveSuccess ?? 0;

        const pools =
            foundry.utils.deepClone(conflict.pools);

        pools.discipline.push(
            ...Array(amount).fill(1)
        );

        const result = resolveRoll({
            ...pools,
            bonusSuccesses:
            conflict.helper?.successes ?? 0
        });

        const updatedConflict = {
            ...conflict,

            pools,

            result: {
            playerSuccesses: result.playerSuccesses,
            painSuccesses: result.painSuccesses,
            success: result.success,
            dominant: result.dominant
            },

            painDominanceCreatedByDespair:
            result.dominant === "pain" &&
            conflict.painDominanceCreatedByDespair === true,

            transformHistory: [
            ...(conflict.transformHistory ?? []),
            {
                actorName: actor.name,
                cost: plan.cost,
                improveSuccess: amount
            }
            ]
        };

        conflictUpdate = {
            content: buildRollResultContent(
            protagonist,
            conflict.painRating,
            result
            ),

            [`flags.${game.system.id}.conflict`]:
            updatedConflict
        };
    }

  const scars =
    actor.system.scars.map(scar => ({
      text: scar.text,
      recalled: scar.recalled,
      transformed: scar.transformed
    }));

  scars[submission.scarIndex].transformed = true;
  scars[submission.scarIndex].recalled = false;

  const previousScar = {
  text: request.scar.text,
  recalled:
    actor.system.scars[submission.scarIndex].recalled,
  transformed:
    actor.system.scars[submission.scarIndex].transformed
};

const previousValues = Object.fromEntries(
  Object.keys(plan.updates).map(key => [
    key,
    foundry.utils.getProperty(actor, key)
  ])
);

await actor.update({
  ...plan.updates,
  "system.scars": scars
});

if (conflictUpdate) {
  try {
    await message.update(conflictUpdate);
  } catch (error) {
    const currentScars =
      actor.system.scars.map(scar => ({
        text: scar.text,
        recalled: scar.recalled,
        transformed: scar.transformed
      }));

    const current =
      currentScars[submission.scarIndex];

    if (
      current?.text === previousScar.text &&
      current.transformed
    ) {
      currentScars[submission.scarIndex] =
        previousScar;

      previousValues["system.scars"] =
        currentScars;
    }

    await actor.update(previousValues);

    throw error;
  }
}

    if (TALENT_EFFECTS.has(submission.effect)) {
        const card = document.createElement("section");

        card.classList.add(
            "awake-conflict-card",
            "awake-transform-card"
        );

        const title = document.createElement("h3");

        title.textContent =
            game.i18n.localize(
            "AWAKE.Scars.TransformTitle"
            );

        const notice = document.createElement("p");

        notice.textContent =
            game.i18n.format(
            "AWAKE.Scars.TransformTalentNotice",
            {
                name: actor.name
            }
            );

        const resultBlock = document.createElement("div");

        resultBlock.classList.add(
            "awake-conflict-result"
        );

        const effect = document.createElement("p");

        effect.classList.add(
            "awake-transform-effect"
        );

        effect.textContent =
            game.i18n.localize(
            TALENT_EFFECTS.get(submission.effect)
            );

        resultBlock.append(effect);

        card.append(
            title,
            notice,
            resultBlock
        );

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: card.outerHTML
        });
    }

    return true;
}