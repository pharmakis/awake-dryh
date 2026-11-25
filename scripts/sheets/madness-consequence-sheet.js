import {
  getDominanceParticipant,
  enqueueHelpingOperation
} from "../rules/helping.js";
import {
  createNightmareFromSnap
} from "../rules/nightmare.js";


const {
  ApplicationV2,
  HandlebarsApplicationMixin
} = foundry.applications.api;


export class MadnessConsequenceSheet extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id:
      "awake-madness-consequence",

    classes: [
      "awake",
      "awake-madness-consequence-sheet"
    ],

    position: {
      width: 440
    },

    actions: {
      applyConsequence:
        this.#applyConsequence
    }
  };


  static PARTS = {
    form: {
      template:
        "systems/awake-dryh/templates/sheets/madness-consequence-sheet.hbs"
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
      "AWAKE.Consequences.MadnessTitle"
    );
  }


  async _prepareContext(options) {
    const context =
      await super._prepareContext(options);


    const fight =
      this.actor.system.responses.fight;

    const flight =
      this.actor.system.responses.flight;


    context.actorName =
      this.actor.name;

    context.fightChecked =
      fight.checked;

    context.fightTotal =
      fight.total;

    context.flightChecked =
      flight.checked;

    context.flightTotal =
      flight.total;


    context.canCheckFight =
      fight.checked < fight.total;

    context.canCheckFlight =
      flight.checked < flight.total;


    context.willSnap =
      !context.canCheckFight &&
      !context.canCheckFlight;


    return context;
  }


  static async #applyConsequence(
    event,
    target
  ) {
    const consequence =
      target.dataset.consequence;


    const allowed = [
      "fight",
      "flight",
      "snap"
    ];


    if (!allowed.includes(consequence)) {
      return;
    }


    const submission = {
      type:
        "applyMadnessConsequence",

      messageId:
        this.messageId,

      actorUuid:
        this.actor.uuid,

      userId:
        game.user.id,

      consequence
    };


    if (game.user.isGM) {
      await handleMadnessConsequenceSubmission(
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


export async function openMadnessConsequenceSheet({
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
    conflict.result?.dominant !== "madness"
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


  new MadnessConsequenceSheet({
    actor,
    messageId
  }).render({
    force: true
  });
}


export function handleMadnessConsequenceSubmission(
  submission
) {
  return enqueueHelpingOperation(
    () => applyMadnessConsequenceSubmission(submission)
  );
}


async function applyMadnessConsequenceSubmission(
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
    "fight",
    "flight",
    "snap"
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
    conflict.result?.dominant !== "madness"
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


  const fight =
    actor.system.responses.fight;

  const flight =
    actor.system.responses.flight;


  const canCheckFight =
    fight.checked < fight.total;

  const canCheckFlight =
    flight.checked < flight.total;

  const mustSnap =
    !canCheckFight &&
    !canCheckFlight;


  let snapped = false;
  let becameNightmare = false;


  if (consequence === "fight") {
    if (
      mustSnap ||
      !canCheckFight
    ) {
      return;
    }


    await actor.update({
      "system.responses.fight.checked":
        fight.checked + 1
    });
  }


  else if (consequence === "flight") {
    if (
      mustSnap ||
      !canCheckFlight
    ) {
      return;
    }


    await actor.update({
      "system.responses.flight.checked":
        flight.checked + 1
    });
  }


  else if (consequence === "snap") {
    if (!mustSnap) {
      return;
    }


    snapped = true;


    if (actor.system.recovery.active) {
      const preCrashDiscipline =
        actor.system.recovery
          .preCrashDiscipline;


      if (preCrashDiscipline <= 0) {
        return;
      }


      const newPreCrashDiscipline =
        preCrashDiscipline - 1;

      const newPermanentMadness =
        actor.system.permanentMadness + 1;


      becameNightmare =
        newPreCrashDiscipline === 0;


      await actor.update({
        "system.responses.fight.checked":
          0,

        "system.responses.flight.checked":
          0,

        "system.discipline":
          becameNightmare
            ? 0
            : 1,

        "system.permanentMadness":
          newPermanentMadness,

        "system.recovery.preCrashDiscipline":
          newPreCrashDiscipline,

        "system.recovery.active":
          !becameNightmare
      });
    }

    else {
      const discipline =
        actor.system.discipline;

      const permanentMadness =
        actor.system.permanentMadness;


      if (discipline <= 0) {
        return;
      }


      const newDiscipline =
        discipline - 1;

      const newPermanentMadness =
        permanentMadness + 1;


      becameNightmare =
        newDiscipline === 0;


      await actor.update({
        "system.responses.fight.checked":
          0,

        "system.responses.flight.checked":
          0,

        "system.discipline":
          newDiscipline,

        "system.permanentMadness":
          newPermanentMadness
      });
    }
  }


  await message.update({
    [`${participant.flagPath}.dominanceResolved`]: true,

    [`${participant.flagPath}.madnessConsequence`]:
      consequence,

    [`${participant.flagPath}.snapped`]:
      snapped,

    [`${participant.flagPath}.becameNightmare`]:
      becameNightmare
  });
  if (becameNightmare) {
    await createNightmareFromSnap({
      actor,
      conflict,
      participant
    });
  }
}
