# RingCentral Code Generator for TypeScript

This is the code generator for [RingCentral Extensible](https://github.com/ringcentral/ringcentral-extensible) [core module](https://github.com/ringcentral/ringcentral-extensible/tree/master/packages/core). More specifically, the [definitions](https://github.com/ringcentral/ringcentral-extensible/tree/master/packages/core/definitions) and the [paths](https://github.com/ringcentral/ringcentral-extensible/tree/master/packages/core/paths).

We provide this tool because by default the RingCentral Extensible core module only supports public API. 
There are partners and internal teams which need access to internal/beta API. So they can use this tool to generate code themselves.


## Install

```
yarn add ringcentral-code-generator
```


## Usage

```
import generate from 'ringcentral-code-generator'

generate('/path/to/spec.yml', '/path/to/output/folder');
```


## Test

Rename `.env.sample` to `.env`. Edit `.env` to specify the path to spec and the output folder.

```
yarn test
```
