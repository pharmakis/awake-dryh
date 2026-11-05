const { SchemaField, StringField } = foundry.data.fields;

export class MadnessTalentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new StringField({ initial: "" }),

      levels: new SchemaField({
        low: new StringField({ initial: "" }),
        medium: new StringField({ initial: "" }),
        high: new StringField({ initial: "" })
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