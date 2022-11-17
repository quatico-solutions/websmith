# websmith-compiler

Empower your Typescript compilation with powerful addon and transformer capabilities working with your TypeScript source code.

## Getting started

### Installation

Install the websmith compiler package using npm:

```sh
npm i -D @quatico/websmith-compiler
```

## Examples

### Standard compilation

```sh
websmith 
```

### High performance watch mode

If you used ts-loader for webpack before, you probably used the `transpileOnly` option. Websmith provides you this same ability in the CLI:

```sh
websmith --transpileOnly --watch
```
