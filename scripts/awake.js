import { AwakeActorData } from "./data/awake-actor.js";
import { AwakeActorSheet } from "./sheets/awake-actor-sheet.js";
import { ExhaustionTalentData } from "./data/exhaustion-talent.js";
import { MadnessTalentData } from "./data/madness-talent.js";
import { AwakeGearSheet } from "./sheets/awake-gear-sheet.js";
import { AwakeExhaustionTalentSheet } from "./sheets/awake-exhaustion-talent-sheet.js";
import { GearData } from "./data/gear.js";


Hooks.once("init", async () => {
  CONFIG.Actor.dataModels.awake = AwakeActorData;
  CONFIG.Item.dataModels.exhaustionTalent = ExhaustionTalentData;
  CONFIG.Item.dataModels.madnessTalent = MadnessTalentData;
  CONFIG.Item.dataModels.gear = GearData;
  
  await loadTemplates([
    "systems/awake-dryh/templates/shared/gear-fields.hbs",
    "systems/awake-dryh/templates/shared/exhaustion-talent-fields.hbs"
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
});
