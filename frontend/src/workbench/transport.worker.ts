import { simulateTransport } from "../engine/transport";
self.addEventListener("message", (event) => {
  try {
    self.postMessage({
      result: simulateTransport(
        event.data.network,
        event.data.options,
        event.data.request,
      ),
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Transport failed.",
    });
  }
});
