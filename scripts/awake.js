import { AwakeActorData } from "./data/awake-actor.js";
import { ExhaustionTalentData } from "./data/exhaustion-talent.js";


Hooks.once("init", () => {
  CONFIG.Actor.dataModels.awake = AwakeActorData;
  CONFIG.Item.dataModels.exhaustionTalent = ExhaustionTalentData;
});
