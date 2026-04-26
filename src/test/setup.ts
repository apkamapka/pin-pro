import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom (przed v22) nie implementuje File.prototype.arrayBuffer i Blob.prototype.arrayBuffer.
// Importer plików polega na tej metodzie — dodajemy polyfill na poziomie testów.
function patchArrayBuffer(proto: { arrayBuffer?: () => Promise<ArrayBuffer> }) {
  if (typeof proto.arrayBuffer === "function") return;
  proto.arrayBuffer = async function (this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else {
          // stringi też mogą się zdarzyć w niektórych implementacjach — konwertujemy
          const enc = new TextEncoder();
          resolve(enc.encode(String(result ?? "")).buffer);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}
patchArrayBuffer(Blob.prototype as unknown as { arrayBuffer?: () => Promise<ArrayBuffer> });
patchArrayBuffer(File.prototype as unknown as { arrayBuffer?: () => Promise<ArrayBuffer> });
