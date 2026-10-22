// @vitest-environment jsdom
/**
 * Dedicated coverage for the `src/components/AdminHero/index.ts` barrel (#679).
 *
 * Why a separate suite?
 * ---------------------
 * The barrel is the only supported import surface for the AdminHero module
 * (`import { AdminHero } from 'components/AdminHero'`). A refactor that drops,
 * renames, or shadows a re-export compiles fine inside the folder while
 * silently breaking every consumer, and the existing `AdminHero.test.tsx`
 * imports the leaf files directly so it cannot catch that.
 *
 * This suite pins:
 *  - the runtime export surface of the barrel
 *  - reference identity between the barrel and the leaf modules
 *  - the type-level re-exports (compile-time contract)
 *  - that the barrel-imported components render through their real props
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

import * as barrel from './index';
import { AdminHero as AdminHeroLeaf } from './AdminHero';
import { StatusGlyph as StatusGlyphLeaf } from './StatusGlyph';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type {
  AdminHeroProps,
  AdminTileData,
  HealthStatus,
  IncidentData,
  IncidentSeverity,
  StatusGlyphProps,
} from './index';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { AdminHero, StatusGlyph } = barrel;

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

// Types are intentionally consumed so a broken re-export fails type-checking.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TILES: AdminTileData[] = [
  {
    id: 'api-latency',
    label: 'API Latency',
    value: '42ms',
    status: 'healthy' satisfies HealthStatus,
    detail: 'Avg response time',
    href: '/admin/api-latency',
  },
  {
    id: 'open-alerts',
    label: 'Open Alerts',
    value: '3',
    status: 'degraded' satisfies HealthStatus,
    href: '/admin/alerts',
  },
  {
    id: 'relay',
    label: 'On-Chain Relay',
    value: 'Connected',
    status: 'outage' satisfies HealthStatus,
    href: '/admin/relay',
  },
  {
    id: 'unknown-check',
    label: 'Indexer',
    value: '?',
    status: 'unknown' satisfies HealthStatus,
    href: '/admin/indexer',
  },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const INCIDENT: IncidentData = {
  id: 'inc-1',
  severity: 'critical' satisfies IncidentSeverity,
  title: 'Partial outage detected',
  message: 'Some services may be affected',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const HERO_PROPS: AdminHeroProps = { tiles: TILES };
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const GLYPH_PROPS: StatusGlyphProps = { status: 'healthy' };

describe('AdminHero barrel (index.ts) — export surface', () => {
  it('exposes exactly the two component re-exports at runtime', () => {
    expect(Object.keys(barrel).sort()).toEqual(['AdminHero', 'StatusGlyph']);
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  it('has no default export (named-only barrel)', () => {
    expect(barrel).not.toHaveProperty('default');
  });

  it('re-exports the same AdminHero reference as the leaf module', () => {
    expect(AdminHero).toBe(AdminHeroLeaf);
    expect(typeof AdminHero).toBe('function');
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  it('re-exports the same StatusGlyph reference as the leaf module', () => {
    expect(StatusGlyph).toBe(StatusGlyphLeaf);
    expect(typeof StatusGlyph).toBe('function');
  });

  it('exposes a display name or function name for debugging', () => {
    expect(AdminHero.name.length).toBeGreaterThan(0);
    expect(StatusGlyph.name.length).toBeGreaterThan(0);
  });
});

describe('AdminHero barrel — AdminHero rendering through the barrel', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  it('renders the section, heading, tiles and drill-down links', () => {
    renderWithRouter(<AdminHero {...HERO_PROPS} />);

    const section = screen.getByRole('region', { name: 'Admin Dashboard' });
    expect(section).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Admin Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'System health tiles' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(TILES.length);
    expect(screen.getAllByRole('link', { name: /View details for/ })).toHaveLength(TILES.length);
    expect(screen.getByRole('link', { name: /View details for API Latency/ })).toHaveAttribute(
      'href',
      '/admin/api-latency',
    );
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  it('renders optional tile detail only when supplied', () => {
    renderWithRouter(<AdminHero tiles={TILES} />);

    expect(screen.getByText('Avg response time')).toBeInTheDocument();
    // The second tile deliberately omits `detail`.
    const withoutDetail = screen.getByTestId('ah-tile-open-alerts');
    expect(withoutDetail.querySelector('.ah-tile-detail')).toBeNull();
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  it('renders an empty tile list without crashing and without an incident banner', () => {
    renderWithRouter(<AdminHero tiles={[]} />);

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Admin Dashboard' })).toBeInTheDocument();
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  it.each([
    ['undefined', undefined],
    ['null', null],
  ])('omits the incident banner when incident is %s', (_label, incident) => {
    renderWithRouter(<AdminHero tiles={TILES} incident={incident} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  it('renders the incident banner and honours onDismissIncident', async () => {
    const user = userEvent.setup();
    const onDismissIncident = vi.fn();

    renderWithRouter(
      <AdminHero tiles={TILES} incident={INCIDENT} onDismissIncident={onDismissIncident} />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('data-testid', 'ah-incident-inc-1');
    expect(alert).toHaveTextContent('Partial outage detected');

    await user.click(screen.getByRole('button', { name: /Dismiss incident: Partial outage/ }));
    expect(onDismissIncident).toHaveBeenCalledWith('inc-1');
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  it('hides the dismiss control when no dismiss handler is provided', () => {
    renderWithRouter(<AdminHero tiles={TILES} incident={INCIDENT} />);

    expect(screen.queryByRole('button', { name: /Dismiss incident/ })).not.toBeInTheDocument();
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  it('applies custom className and id from the public props', () => {
    renderWithRouter(<AdminHero tiles={TILES} className="custom-class" id="hero-x" />);

    const section = document.getElementById('hero-x');
    expect(section).not.toBeNull();
    expect(section).toHaveClass('custom-class');
    expect(section).toHaveAttribute('aria-labelledby', 'hero-x-heading');
  });
});

describe('AdminHero barrel — StatusGlyph rendering through the barrel', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  it.each([
    ['healthy', 'Status: Healthy'],
    ['degraded', 'Status: Degraded'],
    ['outage', 'Status: Outage'],
    ['unknown', 'Status: Unknown'],
  ] as const)('renders %s with an accessible label', (status, label) => {
    render(<StatusGlyph status={status} />);

    const glyph = screen.getByRole('img', { name: label });
    expect(glyph).toHaveAttribute('data-status', status);
    expect(glyph).toHaveAttribute('aria-label', label);
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  it('merges the optional className and defaults it to empty', () => {
    const { unmount } = render(<StatusGlyph {...GLYPH_PROPS} />);
    expect(screen.getByRole('img')).toHaveClass('sg-glyph');
    unmount();

    render(<StatusGlyph status="healthy" className="extra" />);
    expect(screen.getByRole('img')).toHaveClass('extra');
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  it('marks the inner icon as decorative (no duplicate announcement)', () => {
    const { container } = render(<StatusGlyph status="degraded" />);

    const icon = container.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});