const { StringField, NumberField } = foundry.data.fields;

export class GearData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new StringField({ initial: "" }),
      quantity: new NumberField({
        integer: true,
        initial: 1,
        min: 0
      })
    };
  }
}