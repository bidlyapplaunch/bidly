console.log('🚀🚀🚀 MAIN.JSX LOADING 🚀🚀🚀');
import './utils/setupDebugConsole';
console.log('🚀🚀🚀 setupDebugConsole loaded 🚀🚀🚀');
import { initAppBridge } from './appBridgeGlobal';
console.log('🚀🚀🚀 initAppBridge imported 🚀🚀🚀');

initAppBridge();
console.log('🚀🚀🚀 initAppBridge called 🚀🚀🚀');

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
console.log('🚀🚀🚀 React and App imported 🚀🚀🚀');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
console.log('🚀🚀🚀 ReactDOM.render called 🚀🚀🚀');
