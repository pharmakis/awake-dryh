const { StringField } = foundry.data.fields;

export class ExhaustionTalentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new StringField({ initial: "" })
    };
  }
}