"use client";
import { useEffect, useId, useRef, useState } from "react";

type Opt = { value: string; label: string };
export type Help = { title: string; question: string; tip: string };

/**
 * A form field with a "?" button ("Cómo saber este dato") that opens a mini guide right below the field:
 * one plain question, one thing to observe on the plot (or to remember from the last rain) and, when the
 * field has options, the same answers as radio buttons, including "No lo sé". Answers live in the parent's
 * state, so opening or closing the guide never loses them. Keyboard: Enter/Space on "?", Escape closes and
 * returns the focus to the "?" button. The touch target of the button is 44x44.
 */
export default function HelpedField({ label, value, onChange, options, help, helpName, closeText, noKnowText, children, className = "" }: {
  label: string; value?: string; onChange?: (v: string) => void; options?: Opt[]; help: Help;
  helpName: string; closeText: string; noKnowText: string; children?: React.ReactNode; className?: string;
}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = `help-${uid}`;
  const fieldId = `field-${uid}`;

  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>("input,button")?.focus({ preventScroll: false });
  }, [open]);

  const close = () => { setOpen(false); btn.current?.focus(); };

  return (
    <div className={`flex min-w-0 flex-col ${className}`}>
      <div className="flex items-center gap-1 text-sm font-medium">
        {children ? <span>{label}</span> : <label htmlFor={fieldId}>{label}</label>}
        <button ref={btn} type="button" className="help-btn" aria-label={helpName} aria-expanded={open} aria-controls={panelId} title={helpName}
          onClick={() => setOpen((o) => !o)}><span aria-hidden>?</span></button>
      </div>
      {children ?? (options && (
        <select id={fieldId} value={value} onChange={(e) => onChange?.(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}
      {open && (
        <div ref={panel} id={panelId} role="group" aria-label={help.title} className="help-panel t-body mt-2"
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}>
          <p className="t-head">{help.question}</p>
          <p className="mt-1 text-muted">{help.tip}</p>
          {options && (
            <div role="radiogroup" aria-label={help.question} className="mt-2 flex flex-wrap gap-x-4">
              {options.map((o) => (
                <label key={o.value} className="flex min-h-[44px] items-center gap-2">
                  <input type="radio" name={`${panelId}-r`} className="!min-h-0" checked={value === o.value} onChange={() => onChange?.(o.value)} />{o.label}
                </label>
              ))}
            </div>
          )}
          <p className="tag mt-1">{noKnowText}</p>
          <button type="button" className="btn ghost mt-2" onClick={close}>{closeText}</button>
        </div>
      )}
    </div>
  );
}
