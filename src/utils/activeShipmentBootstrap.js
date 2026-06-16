/** Shared bootstrap for active shipments — one GET /shipments/active per dashboard mount. */
let bootstrapPromise = null;

export function runActiveShipmentBootstrap(fn) {
  if (!bootstrapPromise) {
    bootstrapPromise = Promise.resolve(fn()).catch(() => {
      bootstrapPromise = null;
    });
  }
  return bootstrapPromise;
}

export function resetActiveShipmentBootstrap() {
  bootstrapPromise = null;
}
