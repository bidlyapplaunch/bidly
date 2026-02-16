// Use original console.log before it gets patched
const originalLog = window.console.log.bind(window.console);
originalLog('🚀🚀🚀 MAIN.JSX LOADING 🚀🚀🚀');
import './utils/setupDebugConsole';
originalLog('🚀🚀🚀 setupDebugConsole loaded 🚀🚀🚀');
import { initAppBridge } from './appBridgeGlobal';
originalLog('🚀🚀🚀 initAppBridge imported 🚀🚀🚀');

initAppBridge();
originalLog('🚀🚀🚀 initAppBridge called 🚀🚀🚀');

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
originalLog('🚀🚀🚀 React and App imported 🚀🚀🚀');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
originalLog('🚀🚀🚀 ReactDOM.render called 🚀🚀🚀');
