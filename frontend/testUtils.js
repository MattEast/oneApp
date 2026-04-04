import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const ROUTER_FUTURE_FLAGS = {
  v7_startTransition: true,
  v7_relativeSplatPath: true
};

export function renderWithRouter(ui) {
  return render(
    <MemoryRouter future={ROUTER_FUTURE_FLAGS}>
      {ui}
    </MemoryRouter>
  );
}