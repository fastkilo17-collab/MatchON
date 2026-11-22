import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

try {
  const t = localStorage.getItem('matchon.theme');
  if (t && t !== 'green') document.documentElement.setAttribute('data-theme', t);
} catch { /* ignore */ }

createRoot(document.getElementById('root')!).render(<App />);
