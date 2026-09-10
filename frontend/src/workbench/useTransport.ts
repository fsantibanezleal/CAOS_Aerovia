import { useEffect, useRef, useState } from "react";
import { createVizLoop } from "@fasl-work/caos-app-shell";
import type { Network, Options } from "../contracts";
import type { TransportOptions, TransportResult } from "../engine/transport";

export default function useTransport(
  network: Network | null,
  options: Options,
) {
  const [storedResult, setResult] = useState<TransportResult | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [frame, setFrame] = useState(0),
    [playing, setPlaying] = useState(false),
    [rate, setRate] = useState(10);
  const worker = useRef<Worker | null>(null),
    cursor = useRef(0);
  const [input, setInput] = useState<{
    network: Network;
    options: Options;
    request: TransportOptions;
  } | null>(null);
  const result =
    input?.network === network && input.options === options
      ? storedResult
      : null;
  function cancel() {
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
  }
  function clear() {
    cancel();
    setResult(null);
    setInput(null);
    setFrame(0);
    setPlaying(false);
    setError("");
  }
  useEffect(() => {
    cancel();
    setResult(null);
    setFrame(0);
    setPlaying(false);
    setError("");
    return () => worker.current?.terminate();
  }, [network, options]);
  function run(request: TransportOptions) {
    if (!network) return;
    cancel();
    setPlaying(false);
    setResult(null);
    setError("");
    setBusy(true);
    setInput({ network, options, request });
    const active = new Worker(
      new URL("./transport.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.current = active;
    active.onmessage = (event) => {
      if (worker.current !== active) return;
      setResult(event.data.result ?? null);
      setError(event.data.error ?? "");
      setFrame(0);
      cursor.current = 0;
      cancel();
    };
    active.onerror = (event) => {
      if (worker.current === active) {
        setError(event.message);
        cancel();
      }
    };
    active.postMessage({ network, options, request });
  }
  useEffect(() => {
    if (!result?.frames.length || !playing) return;
    cursor.current = result.frames[frame]?.timeSeconds ?? 0;
    const end = result.frames.at(-1)!.timeSeconds;
    const loop = createVizLoop(
      (dt) => {
        cursor.current += (dt / 1000) * rate;
        const index = result.frames.findIndex(
          (f) => f.timeSeconds >= cursor.current,
        );
        setFrame(index < 0 ? result.frames.length - 1 : index);
        return cursor.current < end;
      },
      { onComplete: () => setPlaying(false) },
      { raf: requestAnimationFrame, caf: cancelAnimationFrame },
    );
    const visibility = () => loop.setHidden(document.hidden);
    visibility();
    loop.play();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      loop.dispose();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [result, playing, rate]);
  function scrub(value: number) {
    setPlaying(false);
    setFrame(value);
    cursor.current = result?.frames[value]?.timeSeconds ?? 0;
  }
  function play() {
    if (!result?.frames.length) return;
    if (result && frame === result.frames.length - 1) {
      setFrame(0);
      cursor.current = 0;
    }
    setPlaying((v) => !v);
  }
  return {
    result,
    request: result ? input!.request : null,
    busy,
    error,
    frame,
    playing,
    rate,
    setRate,
    run,
    cancel,
    clear,
    scrub,
    play,
    pause: () => setPlaying(false),
  };
}
