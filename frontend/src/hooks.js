import { useEffect, useState } from "react";

/** Returns `value` only after it stopped changing for `ms` (used for search-as-you-type). */
export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Form helper: values, per-field server errors, a form-level error and a "saving" flag. */
export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e && e.target ? e.target.value : e }));
  const submit = (action) => async (e) => {
    e?.preventDefault?.();
    setSaving(true); setErrors({}); setFormError("");
    try { await action(values); }
    catch (err) { setErrors(err.fields || {}); setFormError(err.message); }
    finally { setSaving(false); }
  };
  return { values, set, setValues, errors, formError, saving, submit };
}
