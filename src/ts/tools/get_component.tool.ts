import {z} from "zod";
import {InferSchema} from "xmcp";
import petriflowDataService from "../services/petriflow-data.service";
import {withToolFeatureFlag} from "../services/feature-flags.service";

export const schema = {
  version: z.string().describe("Version of the schema"),
  name: z.string().describe("Identifier of the component definition, as returned by list_components"),
};

export const outputSchema = {
  component: z.object({
    name: z.string().describe("Identifier of the component definition"),
    names: z.array(z.string()).describe("Values of <name> inside <component> that select this component"),
    fieldTypes: z.array(z.string()).describe("Petriflow data field types the component can be used with"),
    description: z.string().describe("What the component renders"),
    whenToUse: z.string().describe("When to choose this component"),
    params: z.array(z.object({
      name: z.string().describe("Property key, used as <property key=\"...\">"),
      type: z.string().describe("Type of the property value"),
      description: z.string().describe("Description of the property"),
      required: z.boolean().describe("Whether the property is required"),
    })).optional().describe("Configuration properties of the component"),
    examples: z.array(z.string()).optional().describe("Examples of the <component> element"),
    deprecated: z.boolean().optional().describe("Whether the component is deprecated"),
  }),
};

export const metadata = withToolFeatureFlag({
  name: "get_component",
  description: "Get complete definition of a field component, including when to use it and its configuration properties",
  annotation: {
    title: "Get complete definition of a field component",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
});

export default async function getComponent({name, version}: InferSchema<typeof schema>) {
  const component = petriflowDataService.getComponent(version, name);
  return {structuredContent: {component}};
}
