import { validateResponseAllocation } from "../rules/responses.js";
const { ArrayField, BooleanField, SchemaField, StringField, NumberField } = foundry.data.fields;


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
      }),
      scars: new ArrayField(
        new SchemaField({
            text: new StringField({ initial: "" }),
            recalled: new BooleanField({ initial: false }),
            transformed: new BooleanField({ initial: false })
        }),
        {
          initial: () =>
            Array.from({ length: 9 }, () => ({
              text: "",
              recalled: false,
              transformed: false
            }))
        }
      )
    };
  }

  static validateJoint(data) {
    super.validateJoint(data);
    const { fight, flight } = data.responses;
    const responseError = validateResponseAllocation({
      fightTotal: fight.total,
      fightChecked: fight.checked,
      flightTotal: flight.total,
      flightChecked: flight.checked
    });

    if (responseError) {
      throw new Error(game.i18n.localize(responseError));
    }
    if (data.discipline + data.permanentMadness !== 3) {
      throw new Error(game.i18n.localize("AWAKE.Validation.DisciplineMadnessTotal"));
    }
  }
}
