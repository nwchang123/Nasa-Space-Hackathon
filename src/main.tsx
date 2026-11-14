import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/martian-mono/300.css';
import '@fontsource/martian-mono/400.css';
import '@fontsource/martian-mono/600.css';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/400-italic.css';
import '@fontsource/newsreader/600-italic.css';
import './styles.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
