import {
  getDominanceParticipant,
  enqueueHelpingOperation
} from "../rules/helping.js";


const {
  ApplicationV2,
  HandlebarsApplicationMixin
} = foundry.applications.api;


export class DisciplineConsequenceSheet extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "awake-discipline-consequence",

    classes: [
      "awake",
      "awake-discipline-consequence-sheet"
    ],

    position: {
      width: 420
    },

    actions: {
      applyConsequence:
        this.#applyConsequence
    }
  };


  static PARTS = {
    form: {
      template:
        "systems/awake-dryh/templates/sheets/discipline-consequence-sheet.hbs"
    }
  };


  constructor({
    actor,
    messageId
  }, options = {}) {
    super(options);

    this.actor = actor;
    this.messageId = messageId;
  }


  get title() {
    return game.i18n.localize(
      "AWAKE.Consequences.DisciplineTitle"
    );
  }


  async _prepareContext(options) {
    const context =
      await super._prepareContext(options);


    context.actorName =
      this.actor.name;

    context.exhaustion =
      this.actor.system.exhaustion;

    context.fightChecked =
      this.actor.system.responses.fight.checked;

    context.flightChecked =
      this.actor.system.responses.flight.checked;


    context.canReduceExhaustion =
      context.exhaustion > 0;

    context.canClearFight =
      context.fightChecked > 0;

    context.canClearFlight =
      context.flightChecked > 0;


    return context;
  }


  static async #applyConsequence(
    event,
    target
  ) {
    const consequence =
      target.dataset.consequence;


    const allowed = [
      "reduceExhaustion",
      "clearFight",
      "clearFlight",
      "none"
    ];


    if (!allowed.includes(consequence)) {
      return;
    }


    const submission = {
      type:
        "applyDisciplineConsequence",

      messageId:
        this.messageId,

      actorUuid:
        this.actor.uuid,

      userId:
        game.user.id,

      consequence
    };


    if (game.user.isGM) {
      await handleDisciplineConsequenceSubmission(
        submission
      );

      this.close();
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


    this.close();
  }
}


export async function openDisciplineConsequenceSheet({
  messageId,
  actorUuid
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
    conflict.status !== "finalized" ||
    conflict.result?.dominant !== "discipline"
  ) {
    return;
  }


  const participant =
    getDominanceParticipant(
      conflict,
      actorUuid
    );


  if (
    !participant ||
    participant.state.dominanceResolved
  ) {
    return;
  }


  const actor =
    await fromUuid(
      participant.actorUuid
    );


  if (
    !actor ||
    actor.documentName !== "Actor" ||
    actor.type !== "awake"
  ) {
    return;
  }


  const canApply =
    game.user.isGM ||
    actor.testUserPermission(
      game.user,
      CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
    );


  if (!canApply) {
    return;
  }


  new DisciplineConsequenceSheet({
    actor,
    messageId
  }).render({
    force: true
  });
}


export function handleDisciplineConsequenceSubmission(
  submission
) {
  return enqueueHelpingOperation(
    () => applyDisciplineConsequenceSubmission(submission)
  );
}


async function applyDisciplineConsequenceSubmission(
  submission
) {
  if (!game.user.isActiveGM) {
    return;
  }


  const {
    messageId,
    actorUuid,
    userId,
    consequence
  } = submission;


  const allowed = [
    "reduceExhaustion",
    "clearFight",
    "clearFlight",
    "none"
  ];


  if (!allowed.includes(consequence)) {
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
    conflict.status !== "finalized" ||
    conflict.result?.dominant !== "discipline"
  ) {
    return;
  }


  const participant =
    getDominanceParticipant(
      conflict,
      actorUuid
    );


  if (
    !participant ||
    participant.state.dominanceResolved
  ) {
    return;
  }


  const actor =
    await fromUuid(
      participant.actorUuid
    );


  if (
    !actor ||
    actor.documentName !== "Actor" ||
    actor.type !== "awake"
  ) {
    return;
  }


  const user =
    game.users.get(userId);


  if (!user) {
    return;
  }


  const canApply =
    user.isGM ||
    actor.testUserPermission(
      user,
      CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
    );


  if (!canApply) {
    return;
  }


  if (consequence === "reduceExhaustion") {
    const exhaustion =
      actor.system.exhaustion;


    if (exhaustion < 1) {
      return;
    }


    await actor.update({
      "system.exhaustion":
        exhaustion - 1
    });
  }


  else if (consequence === "clearFight") {
    const checked =
      actor.system.responses.fight.checked;


    if (checked < 1) {
      return;
    }


    await actor.update({
      "system.responses.fight.checked":
        checked - 1
    });
  }


  else if (consequence === "clearFlight") {
    const checked =
      actor.system.responses.flight.checked;


    if (checked < 1) {
      return;
    }


    await actor.update({
      "system.responses.flight.checked":
        checked - 1
    });
  }


  await message.update({
    [`${participant.flagPath}.dominanceResolved`]: true,

    [`${participant.flagPath}.disciplineConsequence`]:
      consequence
  });
}
