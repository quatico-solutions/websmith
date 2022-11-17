# websmith-compiler

Commandline tool to execute the addon based code processing and typescript compilation.

Visit the [websmith github repository](https://github.com/websmith) for more information and examples.

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

If you use webpack, you can integrate [@quatico/websmith-webpack](https://github.com/quatico-solutions/websmith/tree/develop/packages/webpack/README.md) into your current webpack setup.
