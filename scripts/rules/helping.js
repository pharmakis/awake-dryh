let helpingQueue = Promise.resolve();


export function enqueueHelpingOperation(operation) {
  const request = helpingQueue.then(operation);

  helpingQueue = request.catch(error => {
    console.error(error);
  });

  return request;
}


export function getEligibleHelpers(conflict, user) {
  if (
    conflict.status !== "awaitingPlayer" ||
    conflict.helper ||
    conflict.helpClosed
  ) {
    return [];
  }

  const protagonist =
    foundry.utils.fromUuidSync(
      conflict.actorUuid
    );

  if (!protagonist) return [];

  if (
    !user.isGM &&
    protagonist.testUserPermission(
      user,
      CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
    )
  ) {
    return [];
  }

  return game.actors.filter(actor =>
    actor.type === "awake" &&
    actor.uuid !== conflict.actorUuid &&
    actor.system.discipline > 0 &&
    (
      user.isGM ||
      actor.testUserPermission(
        user,
        CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
      )
    )
  );
}


export async function requestHelpingAction({
  type,
  messageId,
  actorUuid = null
}) {
  const submission = {
    type,
    messageId,
    actorUuid,
    userId: game.user.id
  };

  if (game.user.isActiveGM) {
    return await handleHelpingSubmission(
      submission
    );
  }

  if (!game.users.activeGM) {
    ui.notifications.warn(
      game.i18n.localize(
        "AWAKE.Conflict.NoActiveGM"
      )
    );

    return false;
  }

  game.socket.emit(
    `system.${game.system.id}`,
    submission
  );

  return true;
}


export function handleHelpingSubmission(submission) {
  return enqueueHelpingOperation(
    () => applyHelpingSubmission(submission)
  );
}


async function applyHelpingSubmission(submission) {
  if (!game.user.isActiveGM) {
    return false;
  }

  const message = game.messages.get(
    submission.messageId
  );

  const conflict = message?.getFlag(
    game.system.id,
    "conflict"
  );

  const user = game.users.get(
    submission.userId
  );

  if (
    !message ||
    !conflict ||
    !user ||
    conflict.status !== "awaitingPlayer"
  ) {
    return false;
  }

  const protagonist =
    await fromUuid(conflict.actorUuid);

  if (!protagonist) return false;


  if (submission.type === "closeHelping") {
    const canBuildRoll =
      user.isGM ||
      protagonist.testUserPermission(
        user,
        CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
      );

    if (!canBuildRoll) return false;

    if (!conflict.helpClosed) {
      await message.update({
        [`flags.${game.system.id}.conflict.helpClosed`]:
          true
      });
    }

    return true;
  }


  if (submission.type !== "joinAsHelper") {
    return false;
  }

  const helper = getEligibleHelpers(
    conflict,
    user
  ).find(actor =>
    actor.uuid === submission.actorUuid
  );

  if (!helper) return false;

  await message.update({
    [`flags.${game.system.id}.conflict.helper`]: {
      actorUuid: helper.uuid,
      actorName: helper.name
    },

    [`flags.${game.system.id}.conflict.helpClosed`]:
      true
  });

  return true;
}

export function getDominanceParticipants(conflict) {
  const participants = [
    {
      actorUuid: conflict.actorUuid,
      state: conflict,

      flagPath:
        `flags.${game.system.id}.conflict`
    }
  ];

  if (conflict.helper) {
    participants.push({
      actorUuid:
        conflict.helper.actorUuid,

      state:
        conflict.helper,

      flagPath:
        `flags.${game.system.id}.conflict.helper`
    });
  }

  return participants;
}


export function getDominanceParticipant(
  conflict,
  actorUuid = conflict.actorUuid
) {
  return getDominanceParticipants(
    conflict
  ).find(
    participant =>
      participant.actorUuid === actorUuid
  );
}


export function allDominanceResolved(conflict) {
  return getDominanceParticipants(
    conflict
  ).every(
    participant =>
      participant.state.dominanceResolved === true
  );
}