import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Apply saved theme on load
const savedTheme = localStorage.getItem('viberyan_theme') || 'dark';
document.documentElement.classList.remove('dark', 'light');
document.documentElement.classList.add(savedTheme);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
