import {expect, test} from "vitest";
import {generateAppManifest} from "../../src/ts/services/app-manifest.service";

test("generates a manifest with all fields and processes in order", () => {
  const xml = generateAppManifest({
    appId: "app",
    name: "New Application",
    version: "1.0.0",
    description: "Demo application",
    author: "Netgrif",
    processes: ["new_model-5", "new_model-6"],
  });

  expect(xml).toBe(`<cases>
\t<case>
\t\t<title>New Application</title>
\t\t<dataField type="text">
\t\t\t<id>app_id</id>
\t\t\t<value>app</value>
\t\t\t<version>1</version>
\t\t</dataField>
\t\t<dataField type="text">
\t\t\t<id>name</id>
\t\t\t<value>New Application</value>
\t\t\t<version>1</version>
\t\t</dataField>
\t\t<dataField type="text">
\t\t\t<id>description</id>
\t\t\t<value>Demo application</value>
\t\t\t<version>1</version>
\t\t</dataField>
\t\t<dataField type="text">
\t\t\t<id>version</id>
\t\t\t<value>1.0.0</value>
\t\t\t<version>1</version>
\t\t</dataField>
\t\t<dataField type="text">
\t\t\t<id>author</id>
\t\t\t<value>Netgrif</value>
\t\t\t<version>1</version>
\t\t</dataField>
\t\t<dataField type="caseRef">
\t\t\t<id>processes</id>
\t\t\t<allowedNets>
\t\t\t\t<value>new_model-5</value>
\t\t\t\t<value>new_model-6</value>
\t\t\t</allowedNets>
\t\t\t<version>1</version>
\t\t</dataField>
\t</case>
</cases>
`);
});

test("omits value elements for empty or blank optional fields and falls back for blank title", () => {
  const xml = generateAppManifest({
    appId: "app", name: "App", version: "1.0.0", processes: ["p"],
    description: "", author: "   ", title: "   ",
  });
  expect(xml).toContain("\t\t\t<id>description</id>\n\t\t\t<version>1</version>");
  expect(xml).toContain("\t\t\t<id>author</id>\n\t\t\t<version>1</version>");
  expect(xml).not.toContain("<value></value>");
  expect(xml).toContain("<title>App</title>");
});

test("uses the title when given and falls back to the name", () => {
  expect(generateAppManifest({appId: "a", name: "Name", title: "Title", version: "1", processes: ["p"]}))
    .toContain("<title>Title</title>");
  expect(generateAppManifest({appId: "a", name: "Name", version: "1", processes: ["p"]}))
    .toContain("<title>Name</title>");
});

test("escapes XML special characters", () => {
  const xml = generateAppManifest({
    appId: "a&b", name: "<Name>", version: "1", description: "\"D\" 'E'", processes: ["p&q"],
  });
  expect(xml).toContain("a&amp;b");
  expect(xml).toContain("&lt;Name&gt;");
  expect(xml).toContain("&quot;D&quot; &apos;E&apos;");
  expect(xml).toContain("p&amp;q");
});
