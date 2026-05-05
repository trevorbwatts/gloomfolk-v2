import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { HostScreen } from './host/HostScreen.js';
import { PlayerScreen } from './player/PlayerScreen.js';
import './styles.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HostScreen />} />
        <Route path="/p" element={<PlayerScreen />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
