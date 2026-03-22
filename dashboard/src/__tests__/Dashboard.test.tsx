import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Sidebar } from '../components/layout/sidebar';

describe('Dashboard Smoke Test', () => {
  it('renders the main navigation with Pipelines link', () => {
    render(
      <BrowserRouter>
        <Sidebar />
      </BrowserRouter>
    );

    // Verify the application title is present
    expect(screen.getByText('Webhook Dashboard')).toBeInTheDocument();

    // Verify key navigation items render
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Logs')).toBeInTheDocument();
    expect(screen.getByText('Pipelines')).toBeInTheDocument();
  });

  it('renders the Control Plane header', () => {
    render(
      <BrowserRouter>
        <Sidebar />
      </BrowserRouter>
    );

    expect(screen.getByText('Control Plane')).toBeInTheDocument();
  });
});
