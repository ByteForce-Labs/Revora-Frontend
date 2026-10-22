/**
 * Tests for GovernanceProposalDetail (Issue #245).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import {
  GovernanceProposalDetail,
  ProposalData,
  ProposalStatus,
  VoteChoice,
} from './GovernanceProposalDetail';

expect.extend(toHaveNoViolations);

const createProposal = (
  overrides: Partial<ProposalData> = {},
): ProposalData => ({
  id: 'prop-1',
  title: 'Increase Developer Grant Fund',
  description:
    'A proposal to allocate an additional 500,000 tokens to the developer grant program to support ecosystem growth.',
  proposer: '0x1234...abcd',
  status: 'active',
  endTime: Date.now() + 86400000 * 3, // 3 days
  quorumRequired: 4_000_000,
  quorumReached: 2_500_000,
  results: { for: 2_000_000, against: 450_000, abstain: 50_000 },
  participation: { turnout: 68.4, uniqueVoters: 142, delegates: 12 },
  userVote: null,
  ...overrides,
});

describe('GovernanceProposalDetail', () => {
  describe('Hero Band', () => {
    it('renders the proposal title and description', () => {
      render(<GovernanceProposalDetail proposal={createProposal()} />);

      expect(
        screen.getByText('Increase Developer Grant Fund'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/allocate an additional 500,000 tokens/i),
      ).toBeInTheDocument();
    });

    it('shows proposer info', () => {
      render(<GovernanceProposalDetail proposal={createProposal()} />);

      expect(screen.getByText(/0x1234/)).toBeInTheDocument();
    });

    it.each([
      ['active', 'Active'],
      ['passed', 'Passed'],
      ['rejected', 'Rejected'],
      ['quorum_failed', 'Quorum Failed'],
    ] as const)('shows state pill for %s status', (status, label) => {
      const proposal = createProposal({ status: status as ProposalStatus });
      render(<GovernanceProposalDetail proposal={proposal} />);

      expect(
        screen.getByTestId(`proposal-pill-${status}`),
      ).toBeInTheDocument();
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    it('shows time remaining for active proposals', () => {
      render(<GovernanceProposalDetail proposal={createProposal()} />);
      expect(screen.getByTestId('time-remaining')).toBeInTheDocument();
    });

    it('does not show time remaining for ended proposals', () => {
      render(
        <GovernanceProposalDetail
          proposal={createProposal({ status: 'passed' })}
        />,
      );
      expect(screen.queryByTestId('time-remaining')).not.toBeInTheDocument();
    });
  });

  describe('Progress Bars', () => {
    it('renders quorum progress bar with aria attributes', () => {
      render(<GovernanceProposalDetail proposal={createProposal()} />);

      const quorumBar = screen.getByRole('progressbar', { name: /quorum/i });
      expect(quorumBar).toBeInTheDocument();
      expect(quorumBar).toHaveAttribute('aria-valuenow', '2500000');
      expect(quorumBar).toHaveAttribute('aria-valuemax', '4000000');
      expect(quorumBar).toHaveAttribute('aria-valuemin', '0');
    });

    it('renders support progress bar with aria attributes', () => {
      render(<GovernanceProposalDetail proposal={createProposal()} />);

      const supportBar = screen.getByRole('progressbar', {
        name: /support/i,
      });
      expect(supportBar).toBeInTheDocument();
      expect(supportBar).toHaveAttribute('aria-valuenow', '2000000');
    });

    it('shows numeric labels on progress bars', () => {
      render(<GovernanceProposalDetail proposal={createProposal()} />);

      expect(screen.getByText('2.5M')).toBeInTheDocument();
      expect(screen.getByText(/\/ 4\.0M/)).toBeInTheDocument();
    });
  });

  describe('Vote CTA', () => {
    it('shows voting buttons for active proposals with no user vote', () => {
      render(<GovernanceProposalDetail proposal={createProposal()} />);

      expect(screen.getByTestId('vote-cta-open')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /for/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /against/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /abstain/i }),
      ).toBeInTheDocument();
    });

    it('calls onVote when a vote button is clicked', () => {
      const onVote = vi.fn();
      render(
        <GovernanceProposalDetail
          proposal={createProposal()}
          onVote={onVote}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /for/i }));
      expect(onVote).toHaveBeenCalledWith('for');
    });

    it('shows voted state when user has already voted', () => {
      render(
        <GovernanceProposalDetail
          proposal={createProposal({ userVote: 'for' as VoteChoice })}
        />,
      );

      expect(screen.getByTestId('vote-cta-voted')).toBeInTheDocument();
      expect(screen.getByText(/you voted/i)).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows closed state for passed proposals', () => {
      render(
        <GovernanceProposalDetail
          proposal={createProposal({ status: 'passed', userVote: null })}
        />,
      );

      expect(screen.getByTestId('vote-cta-closed')).toBeInTheDocument();
      expect(screen.getByText(/voting has closed/i)).toBeInTheDocument();
    });

    it('shows closed state for rejected proposals', () => {
      render(
        <GovernanceProposalDetail
          proposal={createProposal({ status: 'rejected', userVote: null })}
        />,
      );

      expect(screen.getByTestId('vote-cta-closed')).toBeInTheDocument();
      expect(screen.getByText(/proposal rejected/i)).toBeInTheDocument();
    });
  });

  describe('Vote Breakdown', () => {
    it('renders vote breakdown chart', () => {
      render(<GovernanceProposalDetail proposal={createProposal()} />);

      expect(screen.getByTestId('vote-breakdown')).toBeInTheDocument();
      expect(screen.getByText('Vote Breakdown')).toBeInTheDocument();
    });

    it('shows sr-only table with voting results', () => {
      const { container } = render(
        <GovernanceProposalDetail proposal={createProposal()} />,
      );

      const srTable = container.querySelector('.sr-only table');
      expect(srTable).toBeInTheDocument();
      expect(srTable).toHaveTextContent('For');
      expect(srTable).toHaveTextContent('Against');
      expect(srTable).toHaveTextContent('Abstain');
    });

    it('shows percentage and value in legend', () => {
      render(<GovernanceProposalDetail proposal={createProposal()} />);

      expect(screen.getAllByText('80.0%').length).toBeGreaterThan(0); // for: 2M/2.5M
      expect(screen.getAllByText('18.0%').length).toBeGreaterThan(0); // against
      expect(screen.getAllByText('2,000,000').length).toBeGreaterThan(0); // for value
    });
  });

  describe('Participation KPIs', () => {
    it('renders participation cards', () => {
      render(<GovernanceProposalDetail proposal={createProposal()} />);

      expect(screen.getByText('Turnout')).toBeInTheDocument();
      expect(screen.getByText('68.4%')).toBeInTheDocument();
      expect(screen.getByText('Voters')).toBeInTheDocument();
      expect(screen.getByText('142')).toBeInTheDocument();
      expect(screen.getByText('Delegates')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles closed proposals with zero votes', () => {
      const proposal = createProposal({
        status: 'quorum_failed',
        endTime: Date.now() - 86400000,
        quorumReached: 0,
        results: { for: 0, against: 0, abstain: 0 },
        userVote: null,
      });
      render(<GovernanceProposalDetail proposal={proposal} />);

      expect(screen.getByText(/quorum was not reached/i)).toBeInTheDocument();
    });

    it('handles tie states correctly', () => {
      const proposal = createProposal({
        results: { for: 1_000_000, against: 1_000_000, abstain: 500_000 },
        quorumReached: 2_500_000,
      });
      render(<GovernanceProposalDetail proposal={proposal} />);

      expect(screen.getAllByText('40.0%').length).toBeGreaterThanOrEqual(2); // for
      expect(screen.getAllByText('40.0%').length).toBeGreaterThanOrEqual(2); // against
    });

    it('accepts custom className', () => {
      const { container } = render(
        <GovernanceProposalDetail
          proposal={createProposal()}
          className="my-class"
        />,
      );

      expect(container.firstChild).toHaveClass('my-class');
    });
  });

  describe('Accessibility', () => {
    it('has no axe violations for active proposal', async () => {
      const { container } = render(
        <GovernanceProposalDetail proposal={createProposal()} />,
      );

      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations for passed proposal with user vote', async () => {
      const { container } = render(
        <GovernanceProposalDetail
          proposal={createProposal({
            status: 'passed',
            userVote: 'for' as VoteChoice,
          })}
        />,
      );

      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations for rejected proposal', async () => {
      const { container } = render(
        <GovernanceProposalDetail
          proposal={createProposal({
            status: 'rejected',
            userVote: null,
          })}
        />,
      );

      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
