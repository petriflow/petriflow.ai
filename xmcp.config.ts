import {type XmcpConfig} from "xmcp";

const config: XmcpConfig = {
  http: true,
  paths: {
    tools: "./src/tools",
    prompts: "./src/prompts",
    resources: "./src/resources",
  },
  template: {
    name: "Petriflow MCP",
    description: "MCP server for Petriflow, exposing Petriflow tools, prompts, and resources to MCP-compatible AI clients.",
    homePage: "src/index.html",
    icons: [{src: "src/assets/logo.png", mimeType: "image/png"}],
  },
  experimental: {
    adapter: "fastify"
  }
};

export default config;
