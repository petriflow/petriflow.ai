# petriflow.ai

An [MCP](https://modelcontextprotocol.io) server for [Petriflow](https://github.com/netgrif/petriflow), built with [xmcp](https://xmcp.dev). It exposes Petriflow tools, prompts, and resources to MCP-compatible AI clients over HTTP.

> **Status:** early scaffold. The tools/prompts/resources below are placeholder examples from the project template — real Petriflow functionality has not been implemented yet.

## Getting Started

Install dependencies and start the development server:

```bash
pnpm install
pnpm dev
```

This starts the MCP server over HTTP.

## Project Structure

Tools, prompts, and resources are automatically discovered from their respective directories:

- `src/tools` - Tool definitions
- `src/prompts` - Prompt templates
- `src/resources` - Resource handlers

### Tools

Each tool is defined in its own file:

```typescript
import { z } from "zod";
import { type InferSchema, type ToolMetadata } from "xmcp";

export const schema = {
  name: z.string().describe("The name of the user to greet"),
};

export const metadata: ToolMetadata = {
  name: "greet",
  description: "Greet the user",
  annotations: {
    title: "Greet the user",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
};

export default function greet({ name }: InferSchema<typeof schema>) {
  return `Hello, ${name}!`;
}
```

### Prompts

Prompts are template definitions for AI interactions:

```typescript
import { z } from "zod";
import { type InferSchema, type PromptMetadata } from "xmcp";

export const schema = {
  code: z.string().describe("The code to review"),
};

export const metadata: PromptMetadata = {
  name: "review-code",
  title: "Review Code",
  description: "Review code for best practices and potential issues",
  role: "user",
};

export default function reviewCode({ code }: InferSchema<typeof schema>) {
  return `Please review this code: ${code}`;
}
```

### Resources

Resources provide data or content with URI-based access:

```typescript
import { z } from "zod";
import { type ResourceMetadata, type InferSchema } from "xmcp";

export const schema = {
  userId: z.string().describe("The ID of the user"),
};

export const metadata: ResourceMetadata = {
  name: "user-profile",
  title: "User Profile",
  description: "User profile information",
};

export default function handler({ userId }: InferSchema<typeof schema>) {
  return `Profile data for user ${userId}`;
}
```

## Adding New Components

### Adding New Tools

1. Create a new `.ts` file in the `src/tools` directory
2. Export a `schema` object defining the tool parameters using Zod
3. Export a `metadata` object with tool information
4. Export a default function that implements the tool logic

### Adding New Prompts

1. Create a new `.ts` file in the `src/prompts` directory
2. Export a `schema` object defining the prompt parameters using Zod
3. Export a `metadata` object with prompt information and role
4. Export a default function that returns the prompt text

### Adding New Resources

1. Create a new `.ts` file in the `src/resources` directory
2. Use folder structure to define the URI (e.g., `(users)/[userId]/profile.ts` → `users://{userId}/profile`)
3. Export a `schema` object for dynamic parameters (optional for static resources)
4. Export a `metadata` object with resource information
5. Export a default function that returns the resource content

## Building for Production

```bash
pnpm build
```

This compiles the TypeScript code and outputs it to the `dist` directory.

## Running the Server

```bash
pnpm start
```

This runs the built HTTP server (`dist/http.js`).

## Learn More

- [Petriflow](https://github.com/netgrif/petriflow)
- [xmcp Documentation](https://xmcp.dev/docs)
- [Model Context Protocol](https://modelcontextprotocol.io)

## License

Licensed under the [Apache License 2.0](./LICENSE.txt).