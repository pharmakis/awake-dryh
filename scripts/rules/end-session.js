import {
  enqueueHelpingOperation
} from "./helping.js";

let endingSession = false;

export async function endSession() {
  if (!game.user.isActiveGM) {
    ui.notifications.warn(
      game.i18n.localize(
        "AWAKE.Session.ActiveGMOnly"
      )
    );

    return false;
  }

  if (endingSession) return false;

  endingSession = true;

  try {
    const systemId = game.system.id;

    const hope =
      game.settings.get(systemId, "hope");

    const despair =
      game.settings.get(systemId, "despair");

    const confirmed =
      await foundry.applications.api.DialogV2.confirm({
        window: {
          title: game.i18n.localize(
            "AWAKE.Session.Title"
          )
        },

        content: `
          <p>
            ${game.i18n.format(
              "AWAKE.Session.RemainingCoins",
              { hope, despair }
            )}
          </p>

          <p>
            ${game.i18n.localize(
              "AWAKE.Session.Warning"
            )}
          </p>
        `,

        yes: {
          label: game.i18n.localize(
            "AWAKE.Session.Title"
          )
        },

        no: {
          label: game.i18n.localize(
            "AWAKE.Scars.Cancel"
          )
        },

        rejectClose: false
      });

    if (!confirmed) return false;

    return await enqueueHelpingOperation(
      async () => {
        if (!game.user.isActiveGM) {
          return false;
        }

        if (
          game.settings.get(systemId, "hope") !== hope ||
          game.settings.get(systemId, "despair") !== despair
        ) {
          ui.notifications.warn(
            game.i18n.localize(
              "AWAKE.Session.CoinsChanged"
            )
          );

          return false;
        }

        const updates = [];

        for (const actor of game.actors) {
          if (actor.type !== "awake") continue;

          if (
            !actor.system.scars.some(
              scar => scar.recalled
            )
          ) {
            continue;
          }

          updates.push({
            _id: actor.id,

            "system.scars":
              actor.system.scars.map(scar => ({
                text: scar.text,
                recalled: false,
                transformed: scar.transformed
              }))
          });
        }

        if (updates.length) {
          await foundry.documents.Actor.updateDocuments(
            updates
          );
        }

        await game.settings.set(
          systemId,
          "hope",
          0
        );

        await game.settings.set(
          systemId,
          "despair",
          0
        );

        ui.notifications.info(
          game.i18n.localize(
            "AWAKE.Session.Completed"
          )
        );

        return true;
      }
    );
  }

  catch (error) {
    console.error(
      "Awake | End Session failed",
      error
    );

    ui.notifications.error(
      game.i18n.localize(
        "AWAKE.Session.Failed"
      )
    );

    return false;
  }

  finally {
    endingSession = false;
  }
}