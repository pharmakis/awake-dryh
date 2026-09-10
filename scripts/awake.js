import { AwakeActorData } from "./data/awake-actor.js";

Hooks.once("init", () => {
  CONFIG.Actor.dataModels.awake = AwakeActorData;
});
