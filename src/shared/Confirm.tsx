import { useEffect, useRef, type ReactNode } from "react";

/** An in-app confirmation, used instead of the browser's own dialogs. */
export function Confirm({
  open, title, children, confirmLabel, danger = false, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="confirm" onCancel={(e) => { e.preventDefault(); onCancel(); }} aria-labelledby="confirm-title">
      <h2 id="confirm-title">{title}</h2>
      <div className="confirm-body">{children}</div>
      <div className="actions">
        <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>
        <button type="button" className={danger ? "btn btn-danger" : "btn"} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </dialog>
  );
}
