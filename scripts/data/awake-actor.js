const { SchemaField, StringField, NumberField } = foundry.data.fields;

export class AwakeActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      identity: new StringField({ initial: "" }),
      questionnaire: new SchemaField({
        whatsKeepingYouAwake: new StringField({ initial: "" }),
        whatJustHappened: new StringField({ initial: "" }),
        whatsOnTheSurface: new StringField({ initial: "" }),
        whatLiesBeneath: new StringField({ initial: "" }),
        whatsYourPath: new StringField({ initial: "" })
      }),
      discipline: new NumberField({ integer: true, initial: 3, min: 0, max: 3 }),
      exhaustion: new NumberField({ integer: true, initial: 0, min: 0, max: 6 }),
      permanentMadness: new NumberField({ integer: true, initial: 0, min: 0, max: 3 }),
      responses: new SchemaField({
        fight: new SchemaField({
          total: new NumberField({ integer: true, initial: 0, min: 0, max: 3 }),
          checked: new NumberField({ integer: true, initial: 0, min: 0, max: 3 })
        }),
        flight: new SchemaField({
          total: new NumberField({ integer: true, initial: 0, min: 0, max: 3 }),
          checked: new NumberField({ integer: true, initial: 0, min: 0, max: 3 })
        })
      })
    };
  }

  static validateJoint(data) {
    super.validateJoint(data);
    const { fight, flight } = data.responses;

    if (fight.checked > fight.total) {
      throw new Error(game.i18n.localize("AWAKE.Validation.FightCheckedExceedsTotal"));
    }
    if (flight.checked > flight.total) {
      throw new Error(game.i18n.localize("AWAKE.Validation.FlightCheckedExceedsTotal"));
    }

    const totalResponses = fight.total + flight.total;
    if (totalResponses !== 0 && totalResponses !== 3) {
      throw new Error(game.i18n.localize("AWAKE.Validation.ResponseAllocation"));
    }
  }
}
