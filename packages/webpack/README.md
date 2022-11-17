# websmith-webpack

Empower your webpack bundling processes with powerful addon and transformer capabilities working with your TypeScript source code.

## Getting started

### Installation

Install the websmith webpack package using npm:

```sh
npm i -D @quatico/websmith-webpack
```

## Examples

### Standard bundling and transpilation

```sh
websmith 
```

### High performance watch mode

If you used ts-loader for webpack before, you probably used the `transpileOnly` option. Websmith provides you this same ability in the CLI:

```sh
websmith --transpileOnly --watch
```
