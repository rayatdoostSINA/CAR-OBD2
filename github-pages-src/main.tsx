import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App';
import '../app/globals.css';
import '../app/extras.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
