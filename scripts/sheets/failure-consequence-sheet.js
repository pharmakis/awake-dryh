import {
  allDominanceResolved,
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


export class FailureConsequenceSheet extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id:
      "awake-failure-consequence",

    classes: [
      "awake",
      "awake-failure-consequence-sheet"
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
        "systems/awake-dryh/templates/sheets/failure-consequence-sheet.hbs"
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
      "AWAKE.Consequences.FailureTitle"
    );
  }


  async _prepareContext(options) {
    const context =
      await super._prepareContext(options);


    const message =
      game.messages.get(
        this.messageId
      );

    const conflict =
      message?.getFlag(
        game.system.id,
        "conflict"
      );


    const fight =
      this.actor.system.responses.fight;

    const flight =
      this.actor.system.responses.flight;


    const dominant =
      conflict?.result?.dominant;


    context.actorName =
      this.actor.name;

    context.exhaustion =
      this.actor.system.exhaustion;

    context.fightChecked =
      fight.checked;

    context.fightTotal =
      fight.total;

    context.flightChecked =
      flight.checked;

    context.flightTotal =
      flight.total;


    /*
     * Failure may not duplicate the effect
     * already caused by dominance.
     */
    context.canIncreaseExhaustion =
      dominant !== "exhaustion";

    context.responsesAllowed =
      dominant !== "madness";


    context.canCheckFight =
      context.responsesAllowed &&
      fight.checked < fight.total;

    context.canCheckFlight =
      context.responsesAllowed &&
      flight.checked < flight.total;


    context.willSnap =
      context.responsesAllowed &&
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


    const applied =
      await applyFailureConsequence({
        messageId:
          this.messageId,

        actorUuid:
          this.actor.uuid,

        consequence
      });


    if (applied) {
      this.close();
    }
  }
}


export async function openFailureConsequenceSheet({
  messageId,
  actorUuid
}) {
  if (!game.user.isGM) {
    return;
  }


  const message =
    game.messages.get(
      messageId
    );

  const conflict =
    message?.getFlag(
      game.system.id,
      "conflict"
    );


  if (
    !message ||
    !conflict ||
    conflict.status !== "finalized" ||
    conflict.result?.success !== false ||
    !allDominanceResolved(conflict)
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
    participant.state.becameNightmare ||
    participant.state.failureResolved
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


  new FailureConsequenceSheet({
    actor,
    messageId
  }, {
    id: `awake-failure-consequence-${messageId}-${actor.id}`
  }).render({
    force: true
  });
}


function applyFailureConsequence(submission) {
  return enqueueHelpingOperation(
    () => applyFailureConsequenceForParticipant(submission)
  );
}


async function applyFailureConsequenceForParticipant({
  messageId,
  actorUuid,
  consequence
}) {
  if (!game.user.isGM) {
    return false;
  }


  const allowed = [
    "exhaustion",
    "fight",
    "flight",
    "snap",
    "none"
  ];


  if (!allowed.includes(consequence)) {
    return false;
  }


  const message =
    game.messages.get(
      messageId
    );

  const conflict =
    message?.getFlag(
      game.system.id,
      "conflict"
    );


  if (
    !message ||
    !conflict ||
    conflict.status !== "finalized" ||
    conflict.result?.success !== false ||
    !allDominanceResolved(conflict)
  ) {
    return false;
  }


  const participant =
    getDominanceParticipant(
      conflict,
      actorUuid
    );

  if (
    !participant ||
    participant.state.becameNightmare ||
    participant.state.failureResolved
  ) {
    return false;
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
    return false;
  }


  const dominant =
    conflict.result?.dominant;


  let crashed = false;
  let snapped = false;
  let becameNightmare = false;


  /*
   * GM chooses leniency.
   */
  if (consequence === "none") {
    await message.update({
      [`${participant.flagPath}.failureResolved`]: true,

      [`${participant.flagPath}.failureConsequence`]: "none"
    });


    return true;
  }


  /*
   * Failure consequence:
   * increase Exhaustion by 1.
   *
   * Not legal if Exhaustion already dominated.
   */
  if (consequence === "exhaustion") {
    if (dominant === "exhaustion") {
      return false;
    }


    const currentExhaustion =
      actor.system.exhaustion;


    if (currentExhaustion >= 6) {
      crashed = true;


      const preCrashDiscipline =
        actor.system.recovery.active
          ? actor.system.recovery
              .preCrashDiscipline
          : actor.system.discipline;


      await actor.update({
        "system.exhaustion":
          0,

        "system.responses.fight.checked":
          0,

        "system.responses.flight.checked":
          0,

        "system.discipline":
          preCrashDiscipline > 0
            ? 1
            : 0,

        "system.recovery.active":
          preCrashDiscipline > 0,

        "system.recovery.preCrashDiscipline":
          preCrashDiscipline
      });
    }

    else {
      await actor.update({
        "system.exhaustion":
          currentExhaustion + 1
      });
    }
  }


  /*
   * Failure consequence:
   * check a Response chosen by the GM.
   *
   * Not legal if Madness already dominated.
   */
  else if (
    consequence === "fight" ||
    consequence === "flight"
  ) {
    if (dominant === "madness") {
      return false;
    }


    const response =
      actor.system.responses[
        consequence
      ];


    if (
      response.checked >=
      response.total
    ) {
      return false;
    }


    await actor.update({
      [`system.responses.${consequence}.checked`]:
        response.checked + 1
    });
  }


  /*
   * If there are no Responses left to check,
   * choosing a Response consequence causes Snap.
   */
  else if (consequence === "snap") {
    if (dominant === "madness") {
      return false;
    }


    const fight =
      actor.system.responses.fight;

    const flight =
      actor.system.responses.flight;


    const canCheckFight =
      fight.checked < fight.total;

    const canCheckFlight =
      flight.checked < flight.total;


    if (
      canCheckFight ||
      canCheckFlight
    ) {
      return false;
    }


    snapped = true;


    if (actor.system.recovery.active) {
      const preCrashDiscipline =
        actor.system.recovery
          .preCrashDiscipline;


      if (preCrashDiscipline <= 0) {
        return false;
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


      if (discipline <= 0) {
        return false;
      }


      const newDiscipline =
        discipline - 1;

      const newPermanentMadness =
        actor.system.permanentMadness + 1;


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
    [`${participant.flagPath}.failureResolved`]: true,

    [`${participant.flagPath}.failureConsequence`]: consequence,

    [`${participant.flagPath}.crashed`]:
      Boolean(participant.state.crashed || crashed),

    [`${participant.flagPath}.snapped`]:
      Boolean(participant.state.snapped || snapped),

    [`${participant.flagPath}.becameNightmare`]:
      Boolean(participant.state.becameNightmare || becameNightmare),

    [`${participant.flagPath}.failureCrashed`]: crashed,

    [`${participant.flagPath}.failureSnapped`]: snapped
  });
  if (becameNightmare) {
    await createNightmareFromSnap({
      actor,
      conflict,
      participant
    });
  }

  return true;
}
