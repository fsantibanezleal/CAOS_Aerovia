import { useEffect, useRef } from "react";
import { X } from "lucide-react";
export default function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.showModal();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onKeyDown={(event) => {
        if (event.key !== "Tab" || !ref.current) return;
        const controls = [
          ...ref.current.querySelectorAll<HTMLElement>(
            'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ].filter(
          (element) =>
            element.getClientRects().length > 0 &&
            !element.matches(":disabled"),
        );
        const first = controls[0],
          last = controls.at(-1);
        if (!first || !last) return;
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !ref.current.contains(document.activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !ref.current.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      aria-label={title}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button onClick={close} aria-label="Close / Cerrar">
          <X size={20} />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
