import React, { createContext, useState, useEffect } from 'react';

export const ThemeContext = createContext(null);

const STORAGE_KEY = 'transpak_theme';

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'dark';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, darkMode ? 'dark' : 'light');
    const root = document.documentElement;
    root.setAttribute('data-bs-theme', darkMode ? 'dark' : 'light');
    root.style.colorScheme = darkMode ? 'dark' : 'light';
    if (darkMode) {
      document.body.classList.add('dark-theme');
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-theme');
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
