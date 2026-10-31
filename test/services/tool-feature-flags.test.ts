import {expect, test} from "vitest";
import {knownToolNames} from "../../src/ts/services/feature-flags.service";
import {metadata as getAction} from "../../src/ts/tools/get_action.tool";
import {metadata as getComponent} from "../../src/ts/tools/get_component.tool";
import {metadata as getElement} from "../../src/ts/tools/get_element.tool";
import {metadata as getExample} from "../../src/ts/tools/get_example.tool";
import {metadata as getSchema} from "../../src/ts/tools/get_schema.tool";
import {metadata as listActions} from "../../src/ts/tools/list_actions.tool";
import {metadata as listComponents} from "../../src/ts/tools/list_components.tool";
import {metadata as listElements} from "../../src/ts/tools/list_elements.tool";
import {metadata as listExamples} from "../../src/ts/tools/list_examples.tool";
import {metadata as listVersions} from "../../src/ts/tools/list_versions.tool";
import {metadata as overview} from "../../src/ts/tools/overview.tool";
import {metadata as validateAction} from "../../src/ts/tools/validate_action.tool";
import {metadata as validateProcess} from "../../src/ts/tools/validate_process.tool";

test("the feature-flag tool catalog matches XMCP tool metadata names", () => {
  const metadata = [
    getSchema,
    getAction,
    listActions,
    getExample,
    overview,
    listExamples,
    listVersions,
    validateProcess,
    listElements,
    getElement,
    getComponent,
    validateAction,
    listComponents
  ];

  expect(metadata.map(tool => tool.name).sort()).toEqual([...knownToolNames].sort());
  expect(metadata.every(tool => typeof tool.enabled === "boolean")).toBe(true);
});
