import { Hash, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { splitTags } from "../../modules/builds/builds";
import styles from "../../pages/Builds.module.css";

export function BuildTagInput({ label, values, onChange, placeholder, required = false }: { label: string; values: string[]; onChange: (values: string[]) => void; placeholder: string; required?: boolean }) {
  const [raw, setRaw] = useState(values.join(", "));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setRaw(values.join(", ")); }, [values]);
  const update = (next: string) => {
    setRaw(next);
    onChange(splitTags(next));
  };
  const remove = (value: string) => {
    const next = values.filter((entry) => entry !== value);
    setRaw(next.join(", "));
    onChange(next);
  };
  return <label className={styles.tagInput}>
    <span>{label}</span>
    <div><Hash /><input value={raw} required={required} onFocus={() => { focused.current = true; }} onChange={(event) => update(event.target.value)} onBlur={() => { focused.current = false; setRaw(values.join(", ")); }} placeholder={placeholder} /></div>
    {values.length > 0 && <output>{values.map((value) => <button type="button" key={value} onClick={() => remove(value)}>#{value}<X /></button>)}</output>}
  </label>;
}
