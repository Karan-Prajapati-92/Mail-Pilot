import { ChevronDown, TriangleAlert } from 'lucide-react';
import { CLASS_META, CLASS_ORDER } from '../lib/format';

/**
 * Color-coded AI responsibility pill. When `editable`, a transparent native
 * <select> sits on top so the assistant can override the classification
 * (accessible, keyboard friendly, and works on mobile).
 */
export default function ClassPill({ value, editable = false, onChange, size = 'md', disabled = false }) {
  const meta = CLASS_META[value] || CLASS_META.needs_review;
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`relative inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset ${meta.pill} ${pad}`}>
      {value === 'needs_review' ? <TriangleAlert size={12} /> : <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />}
      {meta.label}
      {editable && <ChevronDown size={12} className="opacity-70" />}
      {editable && (
        <select
          aria-label="Change AI classification"
          value={value}
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onChange={(e) => onChange?.(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          {CLASS_ORDER.map((k) => (
            <option key={k} value={k}>
              {CLASS_META[k].label}
            </option>
          ))}
        </select>
      )}
    </span>
  );
}
