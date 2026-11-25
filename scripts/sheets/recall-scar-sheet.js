import { countSuccesses, resolveRoll } from "../rules/roll.js";
import { enqueueHelpingOperation } from "../rules/helping.js";
import { animateDiceRoll } from "../integrations/dice-so-nice.js";
import { buildRollResultContent } from "./build-roll-sheet.js";

const {
  ApplicationV2,
  HandlebarsApplicationMixin,
  DialogV2
} = foundry.applications.api;

const PLAYER_POOLS = ["discipline", "exhaustion", "madness"];

export function getRecallScarTargets(conflict, user) {
  if (!user || conflict?.status !== "modifiable" || !conflict.pools) {
    return [];
  }

  const participants = [{ actorUuid: conflict.actorUuid, isHelper: false }];
  if (conflict.helper) {
    participants.push({ actorUuid: conflict.helper.actorUuid, isHelper: true });
  }

  const targets = [];
  for (const participant of participants) {
    const actor = foundry.utils.fromUuidSync(participant.actorUuid);
    if (!actor || actor.type !== "awake" || actor.system.discipline <= 0) continue;
    if (!user.isGM && !actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) continue;

    const scars = actor.system.scars
      .map((scar, index) => ({ index, ...scar }))
      .filter(scar => scar.text?.trim() && !scar.recalled && !scar.transformed);

    const pools = (participant.isHelper ? ["discipline"] : PLAYER_POOLS)
      .map(key => ({
        key,
        count: (participant.isHelper ? conflict.helper.dice : conflict.pools[key])?.length ?? 0,
        label: game.i18n.localize(`AWAKE.DicePools.${key}`)
      }))
      .filter(pool => pool.count > 0);

    if (scars.length && pools.length) {
      targets.push({ ...participant, actor, scars, pools });
    }
  }
  return targets;
}

function getConflict(messageId) {
  const message = game.messages.get(messageId);
  return { message, conflict: message?.getFlag(game.system.id, "conflict") };
}

export class RecallScarSheet extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "awake-recall-scar",
    classes: ["awake", "awake-recall-scar-sheet"],
    tag: "form",
    position: { width: 400 },
    form: { closeOnSubmit: true, submitOnChange: false, handler: this.#onSubmit }
  };

  static PARTS = {
    form: { template: "systems/awake-dryh/templates/sheets/recall-scar-sheet.hbs" }
  };

  constructor({ messageId, actorUuid }, options = {}) {
    super(options);
    this.messageId = messageId;
    this.actorUuid = actorUuid;
  }

  get title() {
    return game.i18n.localize("AWAKE.Scars.Recall");
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const { conflict } = getConflict(this.messageId);
    const target = getRecallScarTargets(conflict, game.user)
      .find(target => target.actorUuid === this.actorUuid);
    return Object.assign(context, {
      available: Boolean(target),
      actorName: target?.actor.name,
      scars: target?.scars ?? [],
      pools: target?.pools ?? []
    });
  }

  static async #onSubmit(event, form, formData) {
    const { conflict } = getConflict(this.messageId);
    const target = getRecallScarTargets(conflict, game.user)
      .find(target => target.actorUuid === this.actorUuid);
    const scarIndex = Number(formData.object.scarIndex);
    const pool = formData.object.pool;
    const scar = target?.scars.find(scar => scar.index === scarIndex);
    if (!scar || !target.pools.some(p => p.key === pool)) return;

    const submission = {
      type: "recallScar",
      messageId: this.messageId,
      actorUuid: this.actorUuid,
      userId: game.user.id,
      scarIndex,
      scarText: scar.text,
      pool
    };

    if (game.user.isActiveGM) {
      await handleRecallScarSubmission(submission);
    } else if (game.users.activeGM) {
      game.socket.emit(`system.${game.system.id}`, submission);
    } else {
      ui.notifications.warn(game.i18n.localize("AWAKE.Conflict.NoActiveGM"));
    }
  }
}

export function openRecallScarSheet({ messageId, actorUuid }) {
  const { conflict } = getConflict(messageId);
  const target = getRecallScarTargets(conflict, game.user)
    .find(target => target.actorUuid === actorUuid);
  if (!target) return;
  new RecallScarSheet({ messageId, actorUuid }).render({ force: true });
}

function validateSubmission(submission) {
  const { message, conflict } = getConflict(submission.messageId);
  const user = game.users.get(submission.userId);
  if (!message || !user || !Number.isInteger(submission.scarIndex)) return null;
  const target = getRecallScarTargets(conflict, user)
    .find(target => target.actorUuid === submission.actorUuid);
  const scar = target?.scars.find(scar => scar.index === submission.scarIndex && scar.text === submission.scarText);
  const pool = target?.pools.find(pool => pool.key === submission.pool);
  if (!scar || !pool) return null;
  return { message, conflict, target, scar, pool };
}

export async function handleRecallScarSubmission(submission) {
  if (!game.user.isActiveGM) return;
  const request = validateSubmission(submission);
  if (!request) return;

  // Approval happens before entering the queue; no other action has to wait for it.
  const content = document.createElement("p");
  content.textContent = game.i18n.format("AWAKE.Scars.RecallApproval", {
    name: request.target.actor.name,
    scar: request.scar.text,
    pool: request.pool.label
  });
  const approved = await DialogV2.confirm({
    window: { title: game.i18n.localize("AWAKE.Scars.Recall") },
    content: content.outerHTML
  });
  if (!approved) return;

  return enqueueHelpingOperation(() => applyRecallScarSubmission(submission));
}

async function applyRecallScarSubmission(submission) {
  if (!game.user.isActiveGM) return;
  let request = validateSubmission(submission);
  if (!request) return;

  const roll = await new foundry.dice.Roll(`${request.pool.count}d6[${submission.pool}]`)
    .evaluate({ allowInteractive: false });
  const dice = [...roll.dice[0].values];

  // The conflict or scar may have changed while the roll was evaluated.
  request = validateSubmission(submission);
  if (!request || request.pool.count !== dice.length) return;

  const { message, conflict, target } = request;
  const protagonist = foundry.utils.fromUuidSync(conflict.actorUuid);
  if (!protagonist || protagonist.type !== "awake") return;

  const pools = foundry.utils.deepClone(conflict.pools);
  const helper = conflict.helper ? { ...conflict.helper } : null;
  if (target.isHelper) {
    helper.dice = dice;
    helper.successes = countSuccesses(dice);
  } else {
    pools[submission.pool] = dice;
  }

  const result = resolveRoll({ ...pools, bonusSuccesses: helper?.successes ?? 0, talent: conflict.talent });
  const updatedConflict = {
    ...conflict,
    pools,
    helper,
    result: {
      playerSuccesses: result.playerSuccesses,
      painSuccesses: result.painSuccesses,
      success: result.success,
      dominant: result.dominant
    },
    painDominanceCreatedByDespair:
      result.dominant === "pain" && conflict.painDominanceCreatedByDespair === true,
    recallHistory: [
      ...(conflict.recallHistory ?? []),
      { actorName: target.actor.name, pool: submission.pool }
    ]
  };
  const content = buildRollResultContent(protagonist, conflict.painRating, result);

  const scars = target.actor.system.scars.map(scar => ({
    text: scar.text,
    recalled: scar.recalled,
    transformed: scar.transformed
  }));
  scars[submission.scarIndex].recalled = true;
  await target.actor.update({ "system.scars": scars });

  try {
    await message.update({ content, [`flags.${game.system.id}.conflict`]: updatedConflict });
  } catch (error) {
    // Restore the spent recall if the chat update fails; do not overwrite other scars.
    const currentScars = target.actor.system.scars.map(scar => ({
      text: scar.text, recalled: scar.recalled, transformed: scar.transformed
    }));
    const scar = currentScars[submission.scarIndex];
    if (scar?.text === submission.scarText && !scar.transformed) {
      scar.recalled = false;
      await target.actor.update({ "system.scars": currentScars });
    }
    throw error;
  }

  // The animation is cosmetic; don't keep the rules queue waiting for it.
  void animateDiceRoll(roll);
}
