import {
  autoResizeTextareas
} from "./auto-resize-textareas.js";

import {
  openStartConflictSheet
} from "./start-conflict-sheet.js";


const {
  HandlebarsApplicationMixin
} = foundry.applications.api;

const {
  ActorSheetV2
} = foundry.applications.sheets;


export class NightmareActorSheet
  extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["awake", "awake-nightmare-sheet"],

    position: {
      width: 500,
      height: 440
    },

    window: {
      resizable: true
    },

    form: {
      closeOnSubmit: false,
      submitOnChange: true
    },

    actions: {
      startConflict:
        NightmareActorSheet.#onStartConflict
    }
  };


  static PARTS = {
    overview: {
      template:
        "systems/awake-dryh/templates/actor/nightmare-sheet.hbs"
    }
  };


  async _prepareContext(options) {
    const context =
      await super._prepareContext(options);

    context.actor = this.actor;
    context.system = this.actor.system;
    context.editable = this.isEditable;
    context.isGM = game.user.isGM;

    return context;
  }


  async _onRender(context, options) {
    await super._onRender(context, options);

    autoResizeTextareas(this.element);
  }


  static #onStartConflict(event, target) {
    if (!game.user.isGM) return;

    openStartConflictSheet({
        painRating: this.actor.system.pain
    });
  }
}