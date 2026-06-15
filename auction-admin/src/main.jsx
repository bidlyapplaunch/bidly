import './utils/setupDebugConsole';
import { initAppBridge } from './appBridgeGlobal';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

initAppBridge();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
