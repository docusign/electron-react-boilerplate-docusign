import React from 'react';
import { render } from 'react-dom';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

render(
  <MemoryRouter>
    <App />
  </MemoryRouter>,
  document.getElementById('root')
);
