/**
 * Ported from vendor/paperspace apps/web/app/papers/[arxivId]/paper-image.tsx.
 * Capped display height (CSS) + click-to-enlarge lightbox.
 */
import { useEffect, useState } from 'react';

export default function PaperImage({ node: _node, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { node?: unknown }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <img {...props} onClick={() => setOpen(true)} />
      {open && (
        <div className="lightbox-backdrop" onClick={close} role="presentation">
          <img src={props.src ?? ''} alt={props.alt ?? ''} />
          <button type="button" className="lightbox-close" onClick={close} aria-label="Close enlarged image">
            ×
          </button>
        </div>
      )}
    </>
  );
}
