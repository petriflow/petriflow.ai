import type {ResourceCompletions} from "xmcp";

export const complete: ResourceCompletions = {
  version: (value: string) => {
    return ["1.0.0", "1.0.1", "1.0.2", "1.0.3", "1.0.4", "1.0.5", "1.0.6", "1.0.7", "1.0.8", "1.0.9"] // TODO get versions from cache
      .filter((v) => v.startsWith(value));
  }
}
