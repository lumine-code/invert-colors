# invert-colors.provider

Lets a package expose surfaces whose color inversion it owns, without sharing its pane items, rendering implementation or configuration with the consumer.

|             |                                                                 |
| ----------- | --------------------------------------------------------------- |
| Version     | `1.0.0`                                                         |
| Provided by | packages owning invertible surfaces                             |
| Consumed by | `invert-colors` through `consumeInversionProvider(service)`     |
| Owner       | [`invert-colors`](https://github.com/lumine-code/invert-colors) |

## Registration

```json
{
  "providedServices": {
    "invert-colors.provider": {
      "versions": { "1.0.0": "provideInversionProvider" }
    }
  }
}
```

## Contract

```ts
type InversionProvider = {
  targetType: "pdf";
  observeTargets(callback: (target: InversionTarget) => void): Disposable;
};

type InversionTarget = {
  setInverted(inverted: boolean): void;
  onDidDestroy(callback: () => void): Disposable;
};
```

The provider returns an adapter handle for each surface, rather than exposing a pane item or a package-specific viewer API. Each handle has a stable identity for that surface's lifetime. Publish existing handles synchronously when observing and publish new ones as surfaces appear. Repeated publication of the same handle is allowed; the consumer deduplicates it. Disposing the observation stops future publications and releases that provider edge's handles.

`targetType` identifies the inversion category. Version 1 supports `pdf`, controlled by `invert-colors.pdfViewState`. Consumers ignore unknown types without observing their targets, so future categories do not break existing consumers.

`setInverted` applies an absolute Boolean state synchronously, without toggling it or rewriting package configuration. The provider owns its rendering boundary and keeps the state across document reloads. The operation must tolerate repeated values. It may be called with `false` when the last provider edge is released, which restores the normal presentation.

`onDidDestroy` signals the end of that handle's lifetime and returns a disposable listener. The consumer then removes the handle without calling its rendering methods again. Every observer must return a disposable even when it has nothing to register.

The consumer shares a handle across provider edges until its final edge disappears. Disconnecting one provider must not reset a handle still owned by another provider. Listener cleanup may register a replacement provider reentrantly; retiring an old edge must preserve the new ownership and presentation.

Malformed provider shapes and missing observer disposables are rejected during consumption. Invalid targets published later are ignored with a warning instead of throwing into the provider's opener. Providers should validate and construct their handles before publishing them.

## Minimal example

```js
const handle = {
  setInverted: (inverted) => surface.setInversion(inverted),
  onDidDestroy: (callback) => surface.onDidDestroy(callback),
};

provideInversionProvider() {
  return {
    targetType: "pdf",
    observeTargets: (callback) => this.observeHandles(callback),
  };
}
```

The package keeps `handle` with its surface and publishes that same object to every observer. It owns both the adapter and any translation to its renderer.

## Versioning

`1.0.0` provided, `^1.0.0` consumed. A change that breaks this shape gets a new service name rather than a new major version, and both sides move in the same release.
