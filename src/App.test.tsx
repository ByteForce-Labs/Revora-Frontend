import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { WalletConnectionProvider } from "./components/WalletConnection/WalletConnectionContext";

function withProviders(ui: ReactElement) {
  return <WalletConnectionProvider>{ui}</WalletConnectionProvider>;
}

function renderAtPath(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(withProviders(<RouterProvider router={router} />));
}
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { App, routes } from './App';

describe('App Components Accessibility', () => {
  it('renders standard links and buttons correctly', () => {
    renderAtPath("/");
    
    // Test that the 'Get started' and 'Sign In' links render and have href attributes
    const getStartedLink = screen.getByText('Get started');
    const signInLink = screen.getByText('Sign In');
    
    expect(getStartedLink).toBeInTheDocument();
    expect(getStartedLink.tagName.toLowerCase()).toBe('a');
    expect(signInLink).toBeInTheDocument();
    expect(signInLink.tagName.toLowerCase()).toBe('a'); 
  });

  it('renders the header correctly', () => {
    renderAtPath("/");
    const heading = screen.getByRole('heading', { name: /Revora on Stellar/i });
    expect(heading).toBeInTheDocument();
  });

  it.each([
    ["/login", "Welcome to Revora"],
    ["/signup", "Choose your account type"],
    ["/forgot-password", "Forgot Password?"],
    ["/startup/dashboard", "Acme Corp Dashboard"],
    ["/investor/portal", "Discover Offerings"],
  ])("renders the existing route %s", (path, heading) => {
    renderAtPath(path);
    expect(
      screen.getByRole("heading", { name: heading }),
    ).toBeInTheDocument();
  });

  it('provides a skip-to-content link that moves focus to main', async () => {
    render(withProviders(<App />));
    const user = userEvent.setup();

    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    const main = screen.getByRole('main');

    await user.tab();
    expect(skipLink).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(main).toHaveFocus();
  });

  it('uses a single main landmark on each route', () => {
    render(withProviders(<App />));
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('does not throw if skip target is missing', async () => {
    render(withProviders(<App />));
    const user = userEvent.setup();

    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    const originalGetElementById = document.getElementById.bind(document);
    const getElementByIdSpy = vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
      if (id === 'main-content') return null;
      return originalGetElementById(id);
    });

    await user.click(skipLink);
    expect(skipLink).toBeInTheDocument();
    getElementByIdSpy.mockRestore();
  });

  it('enforces one h1 on the investor discovery route and keeps heading hierarchy', () => {
    window.history.pushState({}, '', '/investor/portal');
    render(withProviders(<App />));

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: /discover offerings/i })).toBeInTheDocument();

    expect(screen.getByRole('heading', { level: 2, name: /offerings/i })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).length).toBeGreaterThan(0);
  });

  it('renders the startup dashboard route', () => {
    window.history.pushState({}, '', '/startup/dashboard');
    render(withProviders(<App />));
    expect(screen.getByRole('heading', { level: 1, name: /acme corp dashboard/i })).toBeInTheDocument();
  });

  it('renders the offering registration route with its document uploader', () => {
    window.history.pushState({}, '', '/startup/offering-registration');
    render(withProviders(<App />));
    expect(screen.getByRole('heading', { level: 1, name: /offering registration/i })).toBeInTheDocument();
    expect(screen.getByText('Upload KYC documents')).toBeInTheDocument();
  });
});
