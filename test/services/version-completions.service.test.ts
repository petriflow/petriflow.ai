import {expect, test} from "vitest";
import {createVersionCompletions} from "../../src/ts/services/version-completions.service";

test("completes installed versions and latest by the entered prefix", async () => {
  const completion = createVersionCompletions(() => ["1.0.10", "1.0.2", "2.0.0"]);

  expect(await completion.version("1.0.")).toEqual(["1.0.10", "1.0.2"]);
  expect(await completion.version("lat")).toEqual(["latest"]);
  expect(await completion.version("")).toEqual(["latest", "1.0.10", "1.0.2", "2.0.0"]);
});
