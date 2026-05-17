import React, { useEffect, useMemo, useRef, useState } from 'react';
import { filterCities } from '../../data/pakistanCities.js';
import { useLanguage } from '../../hooks/useLanguage.js';

const CitySelect = ({ name, value, onChange, label, placeholder, required }) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const options = useMemo(() => filterCities(query, 14), [query]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (city) => {
    setQuery(city);
    setOpen(false);
    onChange?.({ target: { name, value: city } });
  };

  return (
    <div className="tp-city-select" ref={wrapRef}>
      {label ? <label className="form-label small">{label}</label> : null}
      <input
        name={name}
        className="form-control form-control-sm rounded-3"
        placeholder={placeholder || t('pages.postLoadForm.citySearchPlaceholder')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          onChange?.({ target: { name, value: e.target.value } });
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        required={required}
        aria-autocomplete="list"
      />
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
