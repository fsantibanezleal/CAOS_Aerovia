import { useEffect, useRef } from "react";
import type { Network, Options, EngineKind } from "./contracts";
export default function useEngine() {
  const worker = useRef<Worker | null>(null);
  const sequence = useRef(0);
  const pending = useRef(
    new Map<
      number,
      { resolve: (value: any) => void; reject: (reason: Error) => void }
    >(),
  );
  useEffect(() => {
    const w = new Worker(new URL("./engine/worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    w.onmessage = (e) => {
      const item = pending.current.get(e.data.id);
      if (!item) return;
      pending.current.delete(e.data.id);
      if (e.data.error) item.reject(new Error(e.data.error));
      else item.resolve(e.data.result);
    };
    w.onerror = () => {
      pending.current.forEach((p) =>
        p.reject(new Error("Calculation worker failed. Reload to recover.")),
      );
      pending.current.clear();
    };
    return () => {
      w.terminate();
      worker.current = null;
      pending.current.forEach((p) => p.reject(new Error("Workspace closed")));
      pending.current.clear();
    };
  }, []);
  return <T>(kind: EngineKind, network: Network, options: Options) =>
    new Promise<T>((resolve, reject) => {
      const id = ++sequence.current;
      if (!worker.current) {
        reject(new Error("Calculation worker is starting"));
        return;
      }
      pending.current.set(id, { resolve, reject });
      worker.current.postMessage({ id, kind, network, options });
    });
}
