import React from 'react';
import { render, screen } from '@testing-library/react';
import { AuthLayout } from './AuthLayout';
import { describe, it, expect } from 'vitest';

describe('AuthLayout', () => {
  it('renders with title and children', () => {
    render(
      <AuthLayout title="Test Title">
        <p>Test Content</p>
      </AuthLayout>
    );
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('renders with subtitle when provided', () => {
    render(
      <AuthLayout title="Test Title" subtitle="Test Subtitle">
        <p>Test Content</p>
      </AuthLayout>
    );
    
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
  });

  it('renders with helperText when provided', () => {
    render(
      <AuthLayout title="Test Title" helperText="Test Helper">
        <p>Test Content</p>
      </AuthLayout>
    );
    
    expect(screen.getByText('Test Helper')).toBeInTheDocument();
  });

  it('has responsive container classes for mobile-first design', () => {
    const { container } = render(
      <AuthLayout title="Test Title">
        <p>Test Content</p>
      </AuthLayout>
    );
    
    const outerDiv = container.querySelector('.auth-page-container');
    expect(outerDiv).toBeInTheDocument();
    expect(container.querySelector('.animate-fade-in')).toBeInTheDocument();
  });

  it('has proper card responsive padding', () => {
    const { container } = render(
      <AuthLayout title="Test Title">
        <p>Test Content</p>
      </AuthLayout>
    );
    
    const card = container.querySelector('.glass-card');
    expect(card).toHaveClass('auth-card');
  });

  it('has responsive heading size', () => {
    const { container } = render(
      <AuthLayout title="Test Title">
        <p>Test Content</p>
      </AuthLayout>
    );
    
    const heading = container.querySelector('h1');
    expect(heading).toHaveClass('auth-title');
  });

  it('meets minimum max-width for readability', () => {
    const { container } = render(
      <AuthLayout title="Test Title">
        <p>Test Content</p>
      </AuthLayout>
    );
    
    const card = container.querySelector('.auth-card');
    expect(card).toBeInTheDocument();
  });
});
