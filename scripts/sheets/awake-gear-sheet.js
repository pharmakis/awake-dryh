const {
  ItemSheetV2
} = foundry.applications.sheets;

const {
  HandlebarsApplicationMixin
} = foundry.applications.api;

export class AwakeGearSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["awake", "awake-gear-sheet"],

    position: {
      width: 500,
      height: 400
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
      template: "systems/awake-dryh/templates/item/gear-sheet.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.item = this.item;
    context.system = this.item.system;
    context.editable = this.isEditable;

    return context;
  }
}