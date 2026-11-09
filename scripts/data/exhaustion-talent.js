const { StringField } = foundry.data.fields;

export class ExhaustionTalentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      scope: new StringField({ initial: "" }),
      description: new StringField({ initial: "" })
    };
  }
}