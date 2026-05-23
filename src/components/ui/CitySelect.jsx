import React, { useEffect, useMemo, useRef, useState } from 'react';
import { filterCities, isKnownCity, resolveCityName } from '../../data/pakistanCities.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useLanguage } from '../../hooks/useLanguage.js';

const CitySelect = ({ name, value, onChange, label, placeholder, required }) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const wrapRef = useRef(null);
  const debouncedQuery = useDebouncedValue(query, 120);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const options = useMemo(() => filterCities(debouncedQuery, 16), [debouncedQuery]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (city) => {
    setQuery(city);
    setInvalid(false);
    setOpen(false);
    onChange?.({ target: { name, value: city } });
  };

  const handleBlur = () => {
    const trimmed = String(query || '').trim();
    if (!trimmed) {
      setInvalid(false);
      return;
    }
    if (isKnownCity(trimmed)) {
      const resolved = resolveCityName(trimmed);
      if (resolved !== trimmed) {
        setQuery(resolved);
        onChange?.({ target: { name, value: resolved } });
      }
      setInvalid(false);
      return;
    }
    setInvalid(true);
  };

  return (
    <div className="tp-city-select" ref={wrapRef}>
      {label ? <label className="form-label small">{label}</label> : null}
      <input
        name={name}
        className={`form-control form-control-sm rounded-3 ${invalid ? 'is-invalid' : ''}`}
        placeholder={placeholder || t('pages.postLoadForm.citySearchPlaceholder')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setInvalid(false);
          setOpen(true);
          onChange?.({ target: { name, value: e.target.value } });
        }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        autoComplete="off"
        required={required}
        aria-autocomplete="list"
        aria-invalid={invalid}
      />
      {invalid ? (
        <div className="invalid-feedback d-block">{t('pages.postLoadForm.cityInvalid')}</div>
      ) : null}
      {open && options.length > 0 ? (
        <ul className="tp-city-select__menu list-unstyled mb-0" role="listbox">
          {options.map((city) => (
            <li key={city}>
              <button type="button" className="tp-city-select__item" onMouseDown={() => pick(city)}>
                {city}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default CitySelect;
