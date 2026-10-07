import {beforeEach, expect, test, vi} from "vitest";

const {getSchemaXsd} = vi.hoisted(() => ({getSchemaXsd: vi.fn()}));

vi.mock("../../src/ts/services/schema.service", () => ({getSchemaXsd}));

import {ValidationService} from "../../src/ts/services/validation.service";

const schema = `
  <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
    <xs:element name="document">
      <xs:complexType>
        <xs:sequence>
          <xs:element name="value" type="xs:string" minOccurs="0" />
        </xs:sequence>
      </xs:complexType>
    </xs:element>
  </xs:schema>
`;

beforeEach(() => {
  getSchemaXsd.mockReset().mockResolvedValue(schema);
});

test("rejects malformed XML without loading an XSD or running semantic rules", async () => {
  const service = new ValidationService();
  const validateRule = vi.fn(() => []);
  service.registerRule({name: "test-rule", description: "test", validate: validateRule});

  const result = await service.validate("<document>", "1.2.3");

  expect(result.valid).toBe(false);
  expect(result.issues[0]).toMatchObject({rule: "xml", severity: "error"});
  expect(getSchemaXsd).not.toHaveBeenCalled();
  expect(validateRule).not.toHaveBeenCalled();
});

test("validates against the version schema and awaits rules in registration order", async () => {
  const service = new ValidationService();
  const order: string[] = [];
  service.registerRules([
    {
      name: "first",
      description: "first rule",
      validate: async (_doc, context) => {
        order.push(`first:${context.version}`);
        return [{rule: "first", severity: "warning", message: "review"}];
      },
    },
    {
      name: "second",
      description: "second rule",
      validate: (_doc, context) => {
        order.push(`second:${context.xml}`);
        return [];
      },
    },
  ]);

  const xml = "<document><value>ok</value></document>";
  const result = await service.validate(xml, "1.2.3");

  expect(getSchemaXsd).toHaveBeenCalledWith("1.2.3");
  expect(order).toEqual(["first:1.2.3", `second:${xml}`]);
  expect(result).toEqual({
    valid: true,
    issues: [{rule: "first", severity: "warning", message: "review"}],
  });
});

test("returns XSD errors and converts a thrown rule into an issue while continuing", async () => {
  const service = new ValidationService();
  const laterRule = vi.fn(() => []);
  service.registerRules([
    {name: "throws", description: "throws", validate: () => { throw new Error("broken rule"); }},
    {name: "later", description: "later", validate: laterRule},
  ]);

  const result = await service.validate("<document><unknown /></document>", "1.2.3");

  expect(result.valid).toBe(false);
  expect(result.issues.some((issue) => issue.rule === "xsd" && issue.severity === "error")).toBe(true);
  expect(result.issues).toContainEqual(expect.objectContaining({
    rule: "throws",
    severity: "error",
    message: 'Rule "throws" threw while validating: broken rule',
  }));
  expect(laterRule).toHaveBeenCalledOnce();
});
