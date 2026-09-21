import {type XmcpConfig} from "xmcp";

const config: XmcpConfig = {
    http: true,
    paths: {
      tools: "./src/tools",
      prompts: false,
      resources: false,
    },
    template: {
      name: "Petriflow MCP",
      description: "MCP server for Petriflow, exposing Petriflow tools, prompts, and resources to MCP-compatible AI clients.",
      instructions: "",
      icons: [{src: "src/assets/logo.png", mimeType: "image/png"}],
    },
    experimental: {
      adapter: "fastify"
    }
  };

export default config;
