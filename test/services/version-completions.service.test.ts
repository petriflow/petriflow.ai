import {expect, test} from "vitest";
import {createVersionCompletions, default as versionCompletions} from "../../src/ts/services/version-completions.service";
import petriflowVersionService from "../../src/ts/services/petriflow-version.service";

test("completes installed versions and latest by the entered prefix", async () => {
  const completion = createVersionCompletions(() => ["1.0.10", "1.0.2", "2.0.0"]);

  expect(await completion.version("1.0.")).toEqual(["1.0.10", "1.0.2"]);
  expect(await completion.version("lat")).toEqual(["latest"]);
  expect(await completion.version("")).toEqual(["latest", "1.0.10", "1.0.2", "2.0.0"]);
});

test("completes only the selected local snapshot version", async () => {
  petriflowVersionService.useLocal({version: "1.2.3", releaseDate: "2026-01-01T00:00:00Z"});
  try {
    expect(await versionCompletions.version("1.2.")).toEqual(["1.2.3"]);
    expect(await versionCompletions.version("")).toEqual(["latest", "1.2.3"]);
  } finally {
    petriflowVersionService.useRemote();
  }
});
