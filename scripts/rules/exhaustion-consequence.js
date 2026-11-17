export async function applyExhaustionConsequence({
  messageId
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
    conflict.result?.dominant !== "exhaustion" ||
    conflict.dominanceResolved
  ) {
    return;
  }


  const actor =
    await fromUuid(
      conflict.actorUuid
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


  const submission = {
    type:
      "applyExhaustionConsequence",

    messageId,

    userId:
      game.user.id
  };


  if (game.user.isGM) {
    await handleExhaustionConsequenceSubmission(
      submission
    );

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
}


export async function handleExhaustionConsequenceSubmission(
  submission
) {
  if (!game.user.isActiveGM) {
    return;
  }


  const {
    messageId,
    userId
  } = submission;


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
    conflict.result?.dominant !== "exhaustion" ||
    conflict.dominanceResolved
  ) {
    return;
  }


  const actor =
    await fromUuid(
      conflict.actorUuid
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


  const currentExhaustion =
    actor.system.exhaustion;


  let crashed = false;


  if (currentExhaustion >= 6) {
    crashed = true;


    const preCrashDiscipline =
      actor.system.discipline;


    await actor.update({
      "system.exhaustion":
        0,

      "system.responses.fight.checked":
        0,

      "system.responses.flight.checked":
        0,

      "system.discipline":
        1,

      "system.recovery.active":
        true,

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


  const updatedConflict = {
    ...conflict,

    dominanceResolved:
      true,

    exhaustionConsequence:
      crashed
        ? "crash"
        : "increaseExhaustion",

    crashed
  };


  await message.update({
    [`flags.${game.system.id}.conflict`]:
      updatedConflict
  });
}