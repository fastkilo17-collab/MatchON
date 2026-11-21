import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

try {
  const t = localStorage.getItem('matchon.theme');
  if (t === 'classic') document.documentElement.setAttribute('data-theme', 'classic');
} catch { /* ignore */ }

createRoot(document.getElementById('root')!).render(<App />);
