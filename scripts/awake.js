import { AwakeActorData } from "./data/awake-actor.js";
import { AwakeActorSheet } from "./sheets/awake-actor-sheet.js";
import { ExhaustionTalentData } from "./data/exhaustion-talent.js";
import { MadnessTalentData } from "./data/madness-talent.js";
import { AwakeGearSheet } from "./sheets/awake-gear-sheet.js";
import { AwakeExhaustionTalentSheet } from "./sheets/awake-exhaustion-talent-sheet.js";
import { AwakeMadnessTalentSheet } from "./sheets/awake-madness-talent-sheet.js";
import { GearData } from "./data/gear.js";
import {  openStartConflictSheet } from "./sheets/start-conflict-sheet.js";
import { openBuildRollSheet, handleConflictRollSubmission } from "./sheets/build-roll-sheet.js";
import { openChalicesSheet } from "./sheets/chalices-sheet.js";
import { openSpendHopeSheet, handleSpendHopeSubmission } from "./sheets/spend-hope-sheet.js";


Hooks.once("init", async () => {
  CONFIG.Actor.dataModels.awake = AwakeActorData;
  CONFIG.Item.dataModels.exhaustionTalent = ExhaustionTalentData;
  CONFIG.Item.dataModels.madnessTalent = MadnessTalentData;
  CONFIG.Item.dataModels.gear = GearData;
  
  await loadTemplates([
    "systems/awake-dryh/templates/shared/gear-fields.hbs",
    "systems/awake-dryh/templates/shared/exhaustion-talent-fields.hbs",
    "systems/awake-dryh/templates/shared/madness-talent-fields.hbs"
  ]);

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
      () => {
        openBuildRollSheet({
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
   */

  if (conflict.status === "modifiable") {
    const button =
      document.createElement("button");

    button.type = "button";

    button.classList.add(
      "awake-spend-hope-button"
    );

    button.textContent =
      game.i18n.localize(
        "AWAKE.Hope.Spend"
      );


    button.addEventListener(
      "click",
      () => {
        openSpendHopeSheet({
          messageId: message.id
        });
      }
    );


    card.append(button);
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