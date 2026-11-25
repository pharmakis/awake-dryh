import { AwakeActorData } from "./data/awake-actor.js";
import { AwakeActorSheet } from "./sheets/awake-actor-sheet.js";
import { ExhaustionTalentData } from "./data/exhaustion-talent.js";
import { MadnessTalentData } from "./data/madness-talent.js";
import { AwakeGearSheet } from "./sheets/awake-gear-sheet.js";
import { AwakeExhaustionTalentSheet } from "./sheets/awake-exhaustion-talent-sheet.js";
import { AwakeMadnessTalentSheet } from "./sheets/awake-madness-talent-sheet.js";
import { GearData } from "./data/gear.js";
import {  openStartConflictSheet } from "./sheets/start-conflict-sheet.js";
import { openBuildRollSheet, handleConflictRollSubmission, finalizeConflict } from "./sheets/build-roll-sheet.js";
import { openChalicesSheet } from "./sheets/chalices-sheet.js";
import { openSpendHopeSheet, handleSpendHopeSubmission } from "./sheets/spend-hope-sheet.js";
import { openCastShadowSheet } from "./sheets/cast-shadow-sheet.js";
import { openDisciplineConsequenceSheet, handleDisciplineConsequenceSubmission } from "./sheets/discipline-consequence-sheet.js";
import { applyExhaustionConsequence, handleExhaustionConsequenceSubmission } from "./rules/exhaustion-consequence.js";
import { openRestoreFromCrashSheet } from "./sheets/restore-from-crash-sheet.js";
import { openMadnessConsequenceSheet, handleMadnessConsequenceSubmission } from "./sheets/madness-consequence-sheet.js";
import { openFailureConsequenceSheet } from "./sheets/failure-consequence-sheet.js";
import { handleActorHopeSubmission } from "./sheets/actor-hope-sheet.js";
import { getEligibleHelpers, requestHelpingAction, handleHelpingSubmission, getDominanceParticipants, allDominanceResolved } from "./rules/helping.js";
import { NightmareActorData } from "./data/nightmare-actor.js";
import { NightmareActorSheet } from "./sheets/nightmare-actor-sheet.js";



Hooks.once("init", async () => {
  CONFIG.Actor.dataModels.awake = AwakeActorData;
  CONFIG.Actor.dataModels.nightmare = NightmareActorData;
  CONFIG.Item.dataModels.exhaustionTalent = ExhaustionTalentData;
  CONFIG.Item.dataModels.madnessTalent = MadnessTalentData;
  CONFIG.Item.dataModels.gear = GearData;


  game.settings.register(game.system.id, "hope", {
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });

  game.settings.register(game.system.id, "despair", {
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });

  const DocumentSheetConfig =
  foundry.applications.apps.DocumentSheetConfig;

  DocumentSheetConfig.registerSheet(
    foundry.documents.Actor,
    game.system.id,
    AwakeActorSheet,
    {
      types: ["awake"],
      makeDefault: true
    }
  );
  DocumentSheetConfig.registerSheet(
    foundry.documents.Actor,
    game.system.id,
    NightmareActorSheet,
    {
      types: ["nightmare"],
      makeDefault: true
    }
  );
  DocumentSheetConfig.registerSheet(
    foundry.documents.Item,
    game.system.id,
    AwakeGearSheet,
    {
      types: ["gear"],
      makeDefault: true
    }
  );
  DocumentSheetConfig.registerSheet(
    foundry.documents.Item,
    game.system.id,
    AwakeExhaustionTalentSheet,
    {
      types: ["exhaustionTalent"],
      makeDefault: true
    }
  );
  DocumentSheetConfig.registerSheet(
  foundry.documents.Item,
  game.system.id,
  AwakeMadnessTalentSheet,
  {
    types: ["madnessTalent"],
    makeDefault: true
  }
  );
  game.awake ??= {};

  game.awake.startConflict = openStartConflictSheet;
  game.awake.openChalices = openChalicesSheet;
  game.awake.restoreFromCrash = openRestoreFromCrashSheet;
});

Hooks.on("preCreateItem", (item, data) => {
  const defaultImages = {
    exhaustionTalent: "systems/awake-dryh/assets/ui/icons/exhaustion-talent.png",
    madnessTalent: "systems/awake-dryh/assets/ui/icons/madness-talent.png",
    gear: "systems/awake-dryh/assets/ui/icons/gear.png"
  };

  const defaultImage = defaultImages[item.type];
  if (!defaultImage) return;

  const currentImage = data.img ?? item.img;

  if (!currentImage || currentImage === "icons/svg/item-bag.svg") {
    item.updateSource({
      img: defaultImage
    });
  }
});

Hooks.on("preCreateActor", (actor, data) => {
  if (actor.type !== "nightmare") return;

  const defaultImage =
    "systems/awake-dryh/assets/ui/icons/nightmare.png";

  const currentImage =
    data.img ?? actor.img;

  if (
    !currentImage ||
    currentImage === "icons/svg/mystery-man.svg"
  ) {
    const updates = {
      img: defaultImage
    };

    const tokenImage =
      data.prototypeToken?.texture?.src ??
      actor.prototypeToken?.texture?.src;

    if (
      !tokenImage ||
      tokenImage === "icons/svg/mystery-man.svg"
    ) {
      updates["prototypeToken.texture.src"] =
        defaultImage;
    }

    actor.updateSource(updates);
  }
});

Hooks.on("renderChatMessageHTML", (message, html) => {
  const conflict = message.getFlag(
    game.system.id,
    "conflict"
  );

  if (!conflict) return;

  const card = html.querySelector(
    ".awake-conflict-card"
  );

   if (!card) return;

  if (conflict.helper) {
    const helperNotice =
      document.createElement("div");

    helperNotice.classList.add(
      "awake-helper-notice"
    );

    const helperName =
      document.createElement("strong");

    helperName.textContent =
      game.i18n.format(
        "AWAKE.Conflict.HelperName",
        {
          name: conflict.helper.actorName
        }
      );

    helperNotice.append(helperName);

    if (Array.isArray(conflict.helper.dice)) {
      const helperResult =
        document.createElement("div");

      helperResult.textContent =
        game.i18n.format(
          "AWAKE.Conflict.HelperRoll",
          {
            dice: conflict.helper.dice.join(", "),
            successes: conflict.helper.successes
          }
        );

      helperNotice.append(helperResult);
    }

    const resultBlock =
      card.querySelector(
        ".awake-conflict-result"
      );

    if (resultBlock) {
      resultBlock.before(helperNotice);
    } else {
      card.append(helperNotice);
    }
  } 

  for (const participant of getDominanceParticipants(conflict)) {
    const state = participant.state;

    if (!state.dominanceResolved) continue;

    if (
      conflict.result?.dominant === "pain" &&
      participant.actorUuid !== conflict.actorUuid
    ) {
      continue;
    }

    const dominanceNotice =
      document.createElement("p");

    dominanceNotice.classList.add(
      "awake-dominance-notice"
    );


    let dominanceText = null;


    /*
    * Discipline dominance
    */
    if (
      conflict.result?.dominant === "discipline"
    ) {
      switch (
        state.disciplineConsequence
      ) {
        case "reduceExhaustion":
          dominanceText =
            game.i18n.localize(
              "AWAKE.Consequences.DisciplineReducedExhaustion"
            );
          break;

        case "clearFight":
          dominanceText =
            game.i18n.localize(
              "AWAKE.Consequences.DisciplineClearedFight"
            );
          break;

        case "clearFlight":
          dominanceText =
            game.i18n.localize(
              "AWAKE.Consequences.DisciplineClearedFlight"
            );
          break;

        case "none":
        case "doNothing":
          dominanceText =
            game.i18n.localize(
              "AWAKE.Consequences.DisciplineNoEffect"
            );
          break;
      }
    }


    /*
    * Exhaustion dominance
    */
    else if (
      conflict.result?.dominant === "exhaustion"
    ) {
      dominanceText =
        (state.exhaustionConsequence === "crash" ||
          (state.exhaustionConsequence == null && state.crashed))
          ? game.i18n.localize(
              "AWAKE.Recovery.CrashNotice"
            )
          : game.i18n.localize(
              "AWAKE.Consequences.ExhaustionIncreased"
            );
    }


    /*
    * Madness dominance
    */
    else if (
      conflict.result?.dominant === "madness"
    ) {
      if (
        state.becameNightmare
      ) {
        dominanceText =
          game.i18n.localize(
            "AWAKE.Consequences.NightmareNotice"
          );
      }

      else if (
        state.snapped
      ) {
        dominanceText =
          game.i18n.localize(
            "AWAKE.Consequences.SnapNotice"
          );
      }

      else if (
        state.madnessConsequence === "fight"
      ) {
        dominanceText =
          game.i18n.localize(
            "AWAKE.Consequences.MadnessCheckedFight"
          );
      }

      else if (
        state.madnessConsequence === "flight"
      ) {
        dominanceText =
          game.i18n.localize(
            "AWAKE.Consequences.MadnessCheckedFlight"
          );
      }
    }


    /*
    * Pain dominance
    */
    else if (
      conflict.result?.dominant === "pain"
    ) {
      dominanceText =
        conflict.despairEarned > 0
          ? game.i18n.localize(
              "AWAKE.Consequences.PainAddedDespair"
            )
          : game.i18n.localize(
              "AWAKE.Consequences.PainNoDespair"
            );
    }


    if (dominanceText) {
      const actor =
        foundry.utils.fromUuidSync(participant.actorUuid);

      const actorName =
        actor?.name ?? state.actorName ?? participant.actorUuid;

      dominanceNotice.textContent =
        conflict.helper && conflict.result?.dominant !== "pain"
          ? `${actorName}: ${dominanceText}`
          : dominanceText;

      card.append(
        dominanceNotice
      );
    }
  }


  /*
   * Awaiting player:
   * selected protagonist owner or GM may build the roll.
   */

  if (conflict.status === "awaitingPlayer") {
    const actor = foundry.utils.fromUuidSync(
      conflict.actorUuid
    );

    if (
      !actor ||
      actor.documentName !== "Actor" ||
      actor.type !== "awake"
    ) {
      return;
    }


    const canBuildRoll =
      game.user.isGM ||
      actor.testUserPermission(
        game.user,
        CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
      );

    const eligibleHelpers =
      getEligibleHelpers(
        conflict,
        game.user
      );

    if (eligibleHelpers.length > 0) {
      let helperSelect = null;

      if (eligibleHelpers.length > 1) {
        helperSelect =
          document.createElement("select");

        helperSelect.classList.add(
          "awake-helper-select"
        );

        for (const helper of eligibleHelpers) {
          const option =
            document.createElement("option");

          option.value = helper.uuid;
          option.textContent = helper.name;

          helperSelect.append(option);
        }

        card.append(helperSelect);
      }


      const helpButton =
        document.createElement("button");

      helpButton.type = "button";

      helpButton.classList.add(
        "awake-help-button"
      );

      helpButton.textContent =
        game.i18n.localize(
          "AWAKE.Conflict.Help"
        );


      helpButton.addEventListener(
        "click",
        async () => {
          helpButton.disabled = true;

          try {
            await requestHelpingAction({
              type: "joinAsHelper",

              messageId: message.id,

              actorUuid:
                helperSelect?.value ??
                eligibleHelpers[0].uuid
            });
          }
          finally {
            helpButton.disabled = false;
          }
        }
      );

      card.append(helpButton);
    }

    if (!canBuildRoll) return;


    const button =
      document.createElement("button");

    button.type = "button";

    button.classList.add(
      "awake-build-roll-button"
    );

    button.textContent =
      game.i18n.localize(
        "AWAKE.Conflict.BuildRoll"
      );


    button.addEventListener(
      "click",
      async () => {
        const accepted =
          await requestHelpingAction({
            type: "closeHelping",
            messageId: message.id
          });

        if (!accepted) return;

        await openBuildRollSheet({
          messageId: message.id
        });
      }
    );


    card.append(button);

    return;
  }


  /*
   * Modifiable:
   * any player may spend Hope.
   * GM may also Cast Shadow or Finalize.
   */

  if (conflict.status === "modifiable") {
    const button =
      document.createElement("button");

    button.type = "button";

    const modifierActions =
      document.createElement("div");

    modifierActions.classList.add(
      "awake-conflict-modifier-actions"
    );

    card.append(
      modifierActions
    );

    button.classList.add(
      "awake-spend-hope-button"
    );

    button.textContent =
      game.i18n.localize(
        "AWAKE.Hope.SpendHope"
      );


    button.addEventListener(
      "click",
      () => {
        openSpendHopeSheet({
          messageId: message.id
        });
      }
    );


    modifierActions.append(
      button
    );


    if (game.user.isGM) {
      const castShadowButton =
        document.createElement("button");

      castShadowButton.type =
        "button";

      castShadowButton.classList.add(
        "awake-cast-shadow-button"
      );

      castShadowButton.textContent =
        game.i18n.localize(
          "AWAKE.Despair.CastShadow"
        );


      castShadowButton.addEventListener(
        "click",
        () => {
          openCastShadowSheet({
            messageId: message.id
          });
        }
      );


      modifierActions.append(
        castShadowButton
      );


      const finalizeButton =
        document.createElement("button");

      finalizeButton.type =
        "button";

      finalizeButton.classList.add(
        "awake-finalize-conflict-button"
      );

      finalizeButton.textContent =
        game.i18n.localize(
          "AWAKE.Conflict.Finalize"
        );


      finalizeButton.addEventListener(
        "click",
        async () => {
          await finalizeConflict({
            messageId: message.id
          });
        }
      );


      card.append(
        finalizeButton
      );
    }
  }
  if (
    conflict.status === "finalized" &&
    [
      "discipline",
      "exhaustion",
      "madness"
    ].includes(conflict.result?.dominant)
  ) {
    const participants =
      getDominanceParticipants(conflict);

    for (const participant of participants) {
      if (participant.state.dominanceResolved) {
        continue;
      }

      const actor =
        foundry.utils.fromUuidSync(
          participant.actorUuid
        );

      if (
        !actor ||
        actor.documentName !== "Actor" ||
        actor.type !== "awake"
      ) {
        continue;
      }

      const canApply =
        game.user.isGM ||
        actor.testUserPermission(
          game.user,
          CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
        );

      if (!canApply) {
        continue;
      }

      const consequenceButton =
        document.createElement("button");

      consequenceButton.type = "button";

      consequenceButton.classList.add(
        "awake-apply-consequence-button"
      );

      const label =
        game.i18n.localize(
          "AWAKE.Conflict.ApplyConsequences"
        );

      consequenceButton.textContent =
        conflict.helper
          ? `${label} — ${actor.name}`
          : label;

      consequenceButton.addEventListener(
        "click",
        async () => {
          const options = {
            messageId: message.id,

            actorUuid:
              participant.actorUuid
          };

          switch (conflict.result.dominant) {
            case "discipline":
              openDisciplineConsequenceSheet(
                options
              );
              break;

            case "exhaustion":
              await applyExhaustionConsequence(
                options
              );
              break;

            case "madness":
              openMadnessConsequenceSheet(
                options
              );
              break;
          }
        }
      );

      card.append(consequenceButton);
    }
  }



  if (
    game.user.isGM &&
    conflict.status === "finalized" &&
    conflict.result?.success === false &&
    allDominanceResolved(conflict)
  ) {
    for (const participant of getDominanceParticipants(conflict)) {
      if (
        participant.state.failureResolved ||
        participant.state.becameNightmare
      ) {
        continue;
      }

      const actor =
        foundry.utils.fromUuidSync(
          participant.actorUuid
        );

      if (
        !actor ||
        actor.documentName !== "Actor" ||
        actor.type !== "awake"
      ) {
        continue;
      }

      const failureButton =
        document.createElement("button");

      failureButton.type = "button";

      failureButton.classList.add(
        "awake-apply-consequence-button"
      );

      const label =
        game.i18n.localize(
          "AWAKE.Consequences.ApplyFailureConsequence"
        );

      failureButton.textContent =
        conflict.helper
          ? `${label} — ${actor.name}`
          : label;

      failureButton.addEventListener(
        "click",
        () => {
          openFailureConsequenceSheet({
            messageId: message.id,
            actorUuid: participant.actorUuid
          });
        }
      );

      card.append(failureButton);
    }
  }

});

Hooks.once("ready", async () => {
  game.socket.on(
    `system.${game.system.id}`,
    async submission => {
      if (!game.user.isActiveGM) {
        return;
      }

      if (
        submission?.type ===
        "submitConflictRoll"
      ) {
        await handleConflictRollSubmission(
          submission
        );
      }
      else if (
        submission?.type ===
           "spendHope"
      ) {
        await handleSpendHopeSubmission(
          submission
        );
      }
      else if (
        submission?.type ===
          "applyDisciplineConsequence"
      ) {
        await handleDisciplineConsequenceSubmission(
          submission
        );
      }
      else if (
        submission?.type ===
          "applyExhaustionConsequence"
      ) {
        await handleExhaustionConsequenceSubmission(
          submission
        );
      }
      else if (
        submission?.type ===
          "applyMadnessConsequence"
      ) {
        await handleMadnessConsequenceSubmission(
          submission
        );
      }
      else if (
          submission?.type === 
            "spendActorHope"
        ) {
          await handleActorHopeSubmission(
            submission
          );
        }
      else if (
        submission?.type === "joinAsHelper" ||
        submission?.type === "closeHelping"
      ) {
        await handleHelpingSubmission(
          submission
        );
      }
    }
  );


  if (!game.user.isGM) return;


  await ensureSystemMacro({
    key: "startConflict",
    name: "Start Conflict",
    command:
      "game.awake.startConflict();",
    img:
      "systems/awake-dryh/assets/ui/icons/pain.png"
  });


  await ensureSystemMacro({
      key: "chalices",
      name: "Chalices",
      command:
        "game.awake.openChalices();",
      img: "systems/awake-dryh/assets/ui/icons/chalice.png"
    });
    await ensureSystemMacro({
    key:
      "restoreFromCrash",

    name:
      game.i18n.localize(
        "AWAKE.Recovery.MacroName"
      ),

    command:
      "game.awake.restoreFromCrash();",

    img:
      "systems/awake-dryh/assets/ui/icons/stats.png"
  });
});

async function ensureSystemMacro({
  key,
  name,
  command,
  img = null
}) {
  let macro = game.macros.find(
    macro =>
      macro.getFlag(
        game.system.id,
        "systemMacro"
      ) === key
  );


  if (!macro) {
    const macroData = {
      name,
      type: "script",
      command,

      flags: {
        [game.system.id]: {
          systemMacro: key
        }
      }
    };


    if (img) {
      macroData.img = img;
    }


    macro =
      await Macro.create(
        macroData
      );
  } 
  else {
    const updates = {};

    if (macro.name !== name) {
      updates.name = name;
    }

    if (macro.command !== command) {
      updates.command = command;
    }

    if (img && macro.img !== img) {
      updates.img = img;
    }

    if (Object.keys(updates).length > 0) {
      await macro.update(updates);
    }
  }

  const hotbar =
    game.user.getHotbarMacros(1);


  const alreadyAssigned =
    hotbar.some(
      slot =>
        slot.macro?.id === macro.id
    );


  if (alreadyAssigned) {
    return;
  }


  const emptySlot =
    hotbar.find(
      slot =>
        slot.macro === null
    );


  if (!emptySlot) {
    ui.notifications.warn(
      `Awake: no free hotbar slot for ${name}.`
    );

    return;
  }


  await game.user.assignHotbarMacro(
    macro,
    emptySlot.slot
  );
}