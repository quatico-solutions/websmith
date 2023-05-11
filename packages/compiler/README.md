# websmith-compiler

Command-line tool to execute the frontend for the TypeScript compiler. Use the package [@quatico/websmith-api](https://github.com/quatico-solutions/websmith/tree/develop/packages/api/README.md) for creating addons to generate extra code and process TypeScript unrelated artifacts, such as Sass, JSON, Java and Markdown, during TypeScript compilation.

Visit the [websmith github repository](https://github.com/quatico-solutions/websmith) for more information and examples.

## Getting started

### Installation

Install the websmith compiler package using npm:

```sh
npm i -D @quatico/websmith-compiler
```

## Using websmith

### Standard compilation

Run the compiler as binary via NodeJS with the following command:

```sh
websmith 
```

### High performance watch mode

If you used `ts-loader` for webpack before, you probably used the `transpileOnly` option. Websmith provide the same ability via CLI parameters:

```sh
websmith --transpileOnly --watch
```

If you use webpack, you can integrate [@quatico/websmith-webpack](https://github.com/quatico-solutions/websmith/tree/develop/packages/webpack/README.md) into your current webpack setup.
