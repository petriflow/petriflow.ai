import storage, {StorageService} from "./storage.service";
import petriflowVersionService from "./petriflow-version.service";

const ELEMENT_DESCRIPTIONS: Record<string, string> = {
  transaction: "Transaction definition",
  data: "Data field definition",
  function: "Function definition",
  role: "Role definition",
  mapping: "Mapping definition",
  transition: "Transition definition",
  place: "Place definition",
  arc: "Arc definition",
  i18n: "Internationalization strings",
  processEvents: "Process events",
  caseEvents: "Case events",
  document: "Root document element",
};

interface LatestVersionProvider {
  resolveVersion(version: string): string;
}

export interface ListedElement {
  name: string;
  description: string;
}

export interface ListedAction {
  name: string;
  signature: string;
  description: string;
}

export interface ListedExample {
  name: string;
  description: string;
}

export class PetriflowDataService {
  constructor(
    private readonly fileStorage: StorageService = storage,
    private readonly versionProvider: LatestVersionProvider = petriflowVersionService,
  ) {}

  getSchemaXsd(version: string): string {
    return this.readRequired(version, "petriflow.schema.xsd");
  }

  getOverview(version: string): string {
    return this.readRequired(version, "overview.md");
  }

  listElements(version: string): ListedElement[] {
    const resolvedVersion = this.resolveVersion(version);
    return this.fileStorage.listVersionFiles(resolvedVersion, "elements")
      .filter((file) => file.endsWith(".xsd"))
      .map((file) => {
        const name = file.slice(0, -4);
        return {name, description: ELEMENT_DESCRIPTIONS[name] ?? ""};
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getElement(version: string, name: string): string {
    return this.readRequired(version, `elements/${name}.xsd`);
  }

  listActions(version: string): ListedAction[] {
    const actions = this.readJsonRecord(version, "actions-definitions.json");
    return Object.keys(actions).map((name) => {
      const action = actions[name] as Record<string, any>;
      if (Array.isArray(action.alts)) {
        return action.alts.map((alternative: Record<string, any>, index: number) => ({
          name: `${name}-${index}`,
          signature: alternative.signature,
          description: alternative.description,
        }));
      }
      if (action.dslChain && typeof action.dslChain === "object") {
        return Object.keys(action.dslChain).map((chain) => ({
          name: `${name}-${chain}`,
          signature: action.dslChain[chain].signature,
          description: action.dslChain[chain].description,
        }));
      }
      return [{name, signature: action.signature, description: action.description}];
    }).flat();
  }

  getAction(version: string, name: string): Record<string, any> {
    const actions = this.readJsonRecord(version, "actions-definitions.json");
    const action = actions[name];
    if (!action || typeof action !== "object") {
      throw new Error(`Action ${name} not found`);
    }
    return {...action, name};
  }

  listExamples(version: string): ListedExample[] {
    const resolvedVersion = this.resolveVersion(version);
    return this.fileStorage.listVersionFiles(resolvedVersion, "examples")
      .filter((file) => file.endsWith(".xml"))
      .map((file) => {
        const name = file.slice(0, -4);
        const content = this.readRequired(resolvedVersion, `examples/${file}`);
        const title = /<\s*title\b[^>]*>([\s\S]*?)<\s*\/\s*title\s*>/i.exec(content)?.[1]?.trim() ?? "";
        return {name, description: title};
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getExample(version: string, example: string): string {
    return this.readRequired(version, `examples/${example}.xml`);
  }

  private readRequired(version: string, relativePath: string): string {
    const resolvedVersion = this.resolveVersion(version);
    const content = this.fileStorage.readVersionFile(resolvedVersion, relativePath);
    if (content === undefined) {
      throw new Error(`Petriflow file ${relativePath} not found for version ${resolvedVersion}`);
    }
    return content;
  }

  private readJsonRecord(version: string, relativePath: string): Record<string, any> {
    const content = this.readRequired(version, relativePath);
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${relativePath} must contain a JSON object`);
    }
    return parsed as Record<string, any>;
  }

  private resolveVersion(version: string): string {
    return this.versionProvider.resolveVersion(version);
  }
}

const petriflowDataService = new PetriflowDataService();
export default petriflowDataService;
