import {type XmcpConfig} from "xmcp";

const config: XmcpConfig = {
    http: true,
    paths: {
      tools: "./src/ts/tools",
      prompts: false,
      resources:"./src/ts/resources",
    },
    template: {
      name: "Petriflow MCP",
      description: "MCP server for Petriflow, exposing Petriflow tools, prompts, and resources to MCP-compatible AI clients.",
      instructions: "",
      icons: [{src: "src/public/assets/logo.png", mimeType: "image/png"}],
    },
    experimental: {
      adapter: "fastify"
    },
    bundler: (config:any) => {
      const configuredExternals = config.externals;
      const externals = Array.isArray(configuredExternals)
        ? configuredExternals
        : configuredExternals
          ? [configuredExternals]
          : [];

      return {
        ...config,
        externals: [...externals, {libxmljs2: "commonjs libxmljs2"}]
      };
    }
  };

export default config;
