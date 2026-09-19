/* Shared result card. `state` drives the colour treatment: verified, unverified
   or error. role="status" + aria-live means screen readers announce the outcome
   without the user having to hunt for it. */
export default function Result({ state, title, children, meta }) {
  if (!state) return null;
  return (
    <div className="result" data-state={state} role="status" aria-live="polite">
      <p className="result-title">{title}</p>
      {children}
      {meta ? <p className="meta">{meta}</p> : null}
    </div>
  );
}
