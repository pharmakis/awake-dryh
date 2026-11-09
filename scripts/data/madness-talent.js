const {
  SchemaField,
  StringField
} = foundry.data.fields;

export class MadnessTalentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new StringField({ initial: "" }),

      levels: new SchemaField({
        one: new StringField({ initial: "" }),
        two: new StringField({ initial: "" }),
        three: new StringField({ initial: "" }),
        four: new StringField({ initial: "" }),
        five: new StringField({ initial: "" }),
        six: new StringField({ initial: "" })
      }),

      breaks: new SchemaField({
        fight: new StringField({ initial: "" }),
        flight: new StringField({ initial: "" })
      }),

      change: new StringField({ initial: "" }),

      becoming: new StringField({ initial: "" })
    };
  }
}