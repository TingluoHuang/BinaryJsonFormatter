import React from 'react';
import './App.css';
import JSON from './components/JSONFormatter/JSONFormatter'

import config from './config/config'

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <a
          className="App-link"
          href={config.headerLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          Binary JSON Formatter
        </a>
      </header>
      <div className="App-container">
        <JSON />
      </div>
    </div>
  );
}

export default App;
