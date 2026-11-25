export async function createNightmareFromSnap({
  actor,
  conflict,
  participant
}) {
  try {
    const pain =
      participant.actorUuid === conflict.actorUuid
        ? conflict.pools.discipline.length +
          conflict.pools.exhaustion.length +
          conflict.pools.madness.length
        : conflict.helper.dice.length;


    if (!Number.isInteger(pain) || pain < 1) {
      throw new Error(
        `Invalid Nightmare Pain: ${pain}`
      );
    }


    const nightmare = await Actor.create({
      name:
        `${actor.name} — ${game.i18n.localize("TYPES.Actor.nightmare")}`,

      type: "nightmare",

      system: {
        pain,
        description: ""
      },

      ownership: {
        default:
          CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE
      }
    });


    if (!nightmare) {
      throw new Error(
        "Nightmare Actor was not created."
      );
    }


    return nightmare;
  }

  catch (error) {
    console.error(
      "Awake | Nightmare creation failed.",
      error
    );

    ui.notifications.error(
      game.i18n.format(
        "AWAKE.Nightmare.CreationFailed",
        {
          name: actor.name
        }
      )
    );

    return null;
  }
}