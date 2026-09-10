import { useId, type ReactNode } from "react";
import "./tool-pages.css";

export interface ToolPage {
  id: string;
  label: string;
  content: ReactNode;
}

interface Props {
  label: string;
  value: string;
  onChange: (id: string) => void;
  pages: ToolPage[];
}

/** Deliberate task sections. Inactive content remains mounted to retain local work. */
export default function ToolPages({ label, value, onChange, pages }: Props) {
  const instance = useId();
  const selected = pages.some((page) => page.id === value)
    ? value
    : pages[0]?.id;
  if (!selected) return null;
  return (
    <div className="av-tool-pages">
      <label className="av-tool-page-picker">
        <span>{label}</span>
        <select
          aria-label={label}
          value={selected}
          onChange={(event) => onChange(event.target.value)}
          aria-controls={`${instance}-${selected}`}
        >
          {pages.map((page) => (
            <option key={page.id} value={page.id}>
              {page.label}
            </option>
          ))}
        </select>
      </label>
      {pages.map((page) => (
        <section
          key={page.id}
          id={`${instance}-${page.id}`}
          className="av-tool-page"
          aria-label={page.label}
          hidden={page.id !== selected}
        >
          {page.content}
        </section>
      ))}
    </div>
  );
}
