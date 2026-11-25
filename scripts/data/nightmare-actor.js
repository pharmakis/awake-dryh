const {
  NumberField,
  StringField
} = foundry.data.fields;


export class NightmareActorData
  extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    return {
      pain: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 1,
        initial: 1
      }),

      description: new StringField({
        required: true,
        nullable: false,
        blank: true,
        initial: ""
      })
    };
  }
}