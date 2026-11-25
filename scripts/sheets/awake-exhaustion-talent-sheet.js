import { autoResizeTextareas } from "./auto-resize-textareas.js";
const {
  ItemSheetV2
} = foundry.applications.sheets;

const {
  HandlebarsApplicationMixin
} = foundry.applications.api;

export class AwakeExhaustionTalentSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["awake", "awake-exhaustion-talent-sheet"],

    position: {
      width: 520,
      height: 500
    },

    window: {
      resizable: true
    },

    form: {
      closeOnSubmit: false,
      submitOnChange: true
    }
  };

  static PARTS = {
    main: {
      template: "systems/awake-dryh/templates/item/exhaustion-talent-sheet.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.item = this.item;
    context.system = this.item.system;
    context.editable = this.isEditable;

    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    autoResizeTextareas(this.element);
  }
}