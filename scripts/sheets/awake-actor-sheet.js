import { validateResponseAllocation } from "../rules/responses.js";
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class AwakeActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["awake", "awake-actor-sheet"],

    position: {
      width: 960,
      height: 1100
    },

    window: {
      resizable: true
    },

    actions: {
      toggleResponsesEdit: AwakeActorSheet.#onToggleResponsesEdit,
      responseBox: AwakeActorSheet.#onResponseBox,

      createItem: AwakeActorSheet.#onCreateItem,
      openItem: AwakeActorSheet.#onOpenItem,
      deleteItem: AwakeActorSheet.#onDeleteItem,

      transformScar: AwakeActorSheet.#onTransformScar,

      spendHope: AwakeActorSheet.#onSpendHope
    }
  };

  static PARTS = {
    overview: {
      template: "systems/awake-dryh/templates/actor/overview.hbs"
    },

    questionnaire: {
      template: "systems/awake-dryh/templates/actor/questionnaire.hbs"
    },

    talents: {
      template: "systems/awake-dryh/templates/actor/talents.hbs"
    },

    gear: {
      template: "systems/awake-dryh/templates/actor/gear.hbs"
    },

    scars: {
      template: "systems/awake-dryh/templates/actor/scars.hbs"
    },
  };

  /**
   * Whether the Response allocation is currently being edited.
   * This is UI state only and is deliberately not stored on the Actor.
   */
  responsesEditMode = false;

  /**
   * Temporary Response allocation while the lock is open.
   * Nothing is written to the Actor until the allocation is confirmed.
   */
  responseDraft = null;

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.actor = this.actor;
    context.system = this.actor.system;
    context.editable = this.isEditable;

    context.items = {
      exhaustionTalents: this.actor.items.filter(
        item => item.type === "exhaustionTalent"
      ),

      madnessTalents: this.actor.items.filter(
        item => item.type === "madnessTalent"
      ),

      gear: this.actor.items.filter(
        item => item.type === "gear"
      )
    };

    context.hope = game.settings.get(game.system.id, "hope");
    context.despair = game.settings.get(game.system.id, "despair");

    const fight = this.actor.system.responses.fight;
    const flight = this.actor.system.responses.flight;

    /*
     * A new Actor has 0 allocated Responses, so its sheet starts
     * automatically in Response setup mode.
     */
    if ((fight.total + flight.total) === 0) {
      this.responsesEditMode = true;
    }

    if (this.responsesEditMode && !this.responseDraft) {
      this.responseDraft = {
        fight: fight.total,
        flight: flight.total
      };
    }

    context.responses = {
      editMode: this.responsesEditMode,

      fight: this.#prepareResponseBoxes(
        "fight",
        fight,
        this.responseDraft?.fight ?? fight.total
      ),

      flight: this.#prepareResponseBoxes(
        "flight",
        flight,
        this.responseDraft?.flight ?? flight.total
      ),

      selected:
        (this.responseDraft?.fight ?? fight.total) +
        (this.responseDraft?.flight ?? flight.total)
    };

    return context;
  }

  /**
   * Prepare the three visual Response positions for one Response type.
   */
  #prepareResponseBoxes(type, response, draftTotal) {
    return Array.from({ length: 3 }, (_, index) => {
      const position = index + 1;

      return {
        type,
        index,
        position,

        /*
         * In edit mode selection comes from the local draft.
         * Otherwise it comes from the persisted Actor data.
         */
        selected: this.responsesEditMode
          ? position <= draftTotal
          : position <= response.total,

        /*
         * checked is always real Actor state.
         * We deliberately keep showing it while editing.
         */
        checked: position <= response.checked,

        /*
         * In play mode boxes which were not chosen during character
         * creation are unavailable.
         */
        unavailable:
          !this.responsesEditMode &&
          position > response.total
      };
    });
  }

  /**
   * Open or close Response allocation mode.
   */
  static async #onToggleResponsesEdit(event, target) {
    if (!this.isEditable) return;

    const fight = this.actor.system.responses.fight;
    const flight = this.actor.system.responses.flight;

    /*
     * Locked -> unlocked.
     * Start a local draft from the current Actor values.
     */
    if (!this.responsesEditMode) {
      this.responsesEditMode = true;

      this.responseDraft = {
        fight: fight.total,
        flight: flight.total
      };

      return this.render();
    }

    /*
     * Unlocked -> locked.
     * Validate the complete draft before touching Actor data.
     */
    const draftFight = this.responseDraft?.fight ?? fight.total;
    const draftFlight = this.responseDraft?.flight ?? flight.total;

    const responseError = validateResponseAllocation({
      fightTotal: draftFight,
      fightChecked: fight.checked,
      flightTotal: draftFlight,
      flightChecked: flight.checked
    });

    if (responseError) {
      ui.notifications.warn(
        game.i18n.localize(responseError)
      );
      return;
    }

    await this.actor.update({
      "system.responses.fight.total": draftFight,
      "system.responses.flight.total": draftFlight
    });

    this.responsesEditMode = false;
    this.responseDraft = null;

    return this.render();
  }

  /**
   * Handle one of the three Fight/Flight Response positions.
   */
  static async #onResponseBox(event, target) {
    if (!this.isEditable) return;

    const type = target.dataset.responseType;
    const index = Number(target.dataset.responseIndex);

    if (!["fight", "flight"].includes(type)) return;
    if (!Number.isInteger(index) || index < 0 || index > 2) return;

    /*
     * EDIT MODE
     *
     * The visual boxes represent allocation.
     * Because boxes within Fight or Flight have no individual identity,
     * clicking position N means "allocate N boxes here".
     *
     * Clicking the last currently selected box removes it.
     */
    if (this.responsesEditMode) {
      this.responseDraft ??= {
        fight: this.actor.system.responses.fight.total,
        flight: this.actor.system.responses.flight.total
      };

      const current = this.responseDraft[type];
      
      let next = current;

        if (index === current && current < 3) {
            // Next empty box: add one.
            next = current + 1;
        } else if (index === current - 1 && current > 0) {
            // Last selected box: remove one.
            next = current - 1;
        } else {
            return;
        }

      const otherType = type === "fight" ? "flight" : "fight";
      const other = this.responseDraft[otherType];

      if ((next + other) > 3) {
        ui.notifications.warn(
          game.i18n.localize("AWAKE.Validation.ResponseAllocation")
        );
        return;
      }

      this.responseDraft[type] = next;

      return this.render();
    }

    /*
     * PLAY MODE
     *
     * Only boxes selected during Response allocation are active.
     * Clicking them changes the checked count.
     */
    const response = this.actor.system.responses[type];

    let nextChecked = response.checked;

    if (index === response.checked && response.checked < response.total) {
        // Check the next available Response.
        nextChecked = response.checked + 1;
    } else if (index === response.checked - 1 && response.checked > 0) {
        // Uncheck the most recently marked Response.
        nextChecked = response.checked - 1;
    } else {
      return;
    }

    await this.actor.update({
      [`system.responses.${type}.checked`]: nextChecked
    });
  }

  /**
   * Create an embedded Item on the Actor.
   */
  static async #onCreateItem(event, target) {
    if (!this.isEditable) return;

    const type = target.dataset.itemType;

    if (!["exhaustionTalent", "madnessTalent", "gear"].includes(type)) {
      return;
    }

    const names = {
      exhaustionTalent: game.i18n.localize(
        "TYPES.Item.exhaustionTalent"
      ),
      madnessTalent: game.i18n.localize(
        "TYPES.Item.madnessTalent"
      ),
      gear: game.i18n.localize(
        "TYPES.Item.gear"
      )
    };

    const [item] = await this.actor.createEmbeddedDocuments("Item", [
      {
        name: names[type],
        type
      }
    ]);

    item?.sheet?.render(true);
  }

  /**
   * Open an embedded Item sheet.
   */
  static #onOpenItem(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    if (!itemId) return;

    const item = this.actor.items.get(itemId);
    item?.sheet?.render(true);
  }

  /**
   * Delete an embedded Item.
   */
  static async #onDeleteItem(event, target) {
    if (!this.isEditable) return;

    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    if (!itemId) return;

    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
  }
  
  /**
   * Transform a Scar.
   */
  static async #onTransformScar (event, target) {
    if (!this.isEditable) return;
    
    const index = Number(target.dataset.scarIndex);

    if (!Number.isInteger(index) || index < 0 || index > 8) {
      return;
    }
    
    const scar = this.actor.system.scars[index];
    
    if (!scar || scar.transformed) {
      return;
    }

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: game.i18n.localize("AWAKE.Scars.TransformTitle")
      },
      content: `
        <p>${game.i18n.localize("AWAKE.Scars.TransformWarning")}</p>
        <p>${game.i18n.localize("AWAKE.Scars.TransformReminder")}</p>
      `,

      yes: {
        label: game.i18n.localize("AWAKE.Scars.TransformConfirm")
      },

      no: {
        label: game.i18n.localize("AWAKE.Scars.Cancel")
      }
    });

    if (!confirmed) return;

    await this.actor.update({
      [`system.scars.${index}.transformed`]: true,
      [`system.scars.${index}.recalled`]: false
    });
  }
  
   /**
   * Spending Hope.
   */
  static async #onSpendHope(event, target) {
    if (!this.isEditable) return;

    await foundry.applications.api.DialogV2.wait({
      window: {
        title: game.i18n.localize("AWAKE.Hope.SpendTitle")
      },

      content: `
        <p>${game.i18n.localize("AWAKE.Hope.SpendPlaceholder")}</p>
      `,

      buttons: [
        {
          action: "close",
          label: game.i18n.localize("AWAKE.Common.Close"),
          default: true
        }
      ]
    });
  }
}