import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useSocketBootstrap } from './net/useSocket.js';
import { HostScreen } from './host/HostScreen.js';
import { PlayerScreen } from './player/PlayerScreen.js';
import { BuilderScreen } from './builder/BuilderScreen.js';

function App() {
  useSocketBootstrap();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HostScreen />} />
        <Route path="/p" element={<PlayerScreen />} />
        <Route path="/builder" element={<BuilderScreen />} />
      </Routes>
    </BrowserRouter>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('no #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
