import { useEffect, useRef } from "react";
export default function ConfirmSheet({
  name,
  cancel,
  confirm,
}: {
  name: string;
  cancel: () => void;
  confirm: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const dialog = ref.current!;
    dialog.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
      if (e.key === "Tab") {
        const buttons = [
          ...dialog.querySelectorAll<HTMLButtonElement>("button"),
        ];
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    dialog.addEventListener("keydown", key);
    return () => {
      dialog.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [cancel]);
  return (
    <div className="modal-backdrop" onClick={cancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-title"
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="remove-title">Remove {name}?</h2>
        <p>
          They will lose access to this room. They can request to join again.
        </p>
        <div className="inline-actions">
          <button onClick={cancel}>Keep member</button>
          <button onClick={confirm}>Remove member</button>
        </div>
      </div>
    </div>
  );
}
