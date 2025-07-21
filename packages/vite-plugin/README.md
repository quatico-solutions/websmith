# Websmith Vite Plugin

A Vite plugin for Websmith that processes TypeScript files.

## Installation

```bash
npm install @quatico/websmith-vite-plugin --save-dev
# or
yarn add -D @quatico/websmith-vite-plugin
# or
pnpm add -D @quatico/websmith-vite-plugin
```

## Usage

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { websmithPlugin } from '@quatico/websmith-vite-plugin';

export default defineConfig({
  plugins: [
    websmithPlugin({
      profile: 'production',
      transpileOnly: true,
      configFile: './websmith.config.json'
    })
  ]
});
```

## Options

- `profile`: The profile name to use for processing files (default: 'default')
- `transpileOnly`: Whether to only transpile and not check types (default: false)
- `configFile`: Path to the Websmith configuration file (default: './websmith.config.json')

## Features

- Processes TypeScript files according to Websmith configuration
- Supports HMR (Hot Module Replacement)
- Works with TypeScript and JSX/TSX files

## License

MIT
