import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { OfferingWizardSummary } from './OfferingWizardSummary';

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <OfferingWizardSummary />
    </MemoryRouter>
  );
};

describe('OfferingWizardSummary', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders section headings', () => {
    renderComponent();

    expect(screen.getByText('Company Details')).toBeInTheDocument();
    expect(screen.getByText('Offering Terms')).toBeInTheDocument();
    expect(screen.getByText('Legal & Compliance')).toBeInTheDocument();
  });

  it('renders edit step links', () => {
    renderComponent();
    
    const editLinks = screen.getAllByRole('link', { name: /Edit step/i });
    expect(editLinks).toHaveLength(3);
    
    expect(editLinks[0]).toHaveAttribute('href', '/startup/wizard/company');
    expect(editLinks[1]).toHaveAttribute('href', '/startup/wizard/terms');
    expect(editLinks[2]).toHaveAttribute('href', '/startup/wizard/legal');
  });

  it('submit button is disabled initially', () => {
    renderComponent();

    const submitBtn = screen.getByRole('button', { name: 'Submit Offering' });
    expect(submitBtn).toBeDisabled();
  });

  it('enables submit button when acknowledgement is checked', async () => {
    const user = userEvent.setup();
    renderComponent();

    const checkbox = screen.getByLabelText(/I acknowledge that by submitting this offering/i);
    const submitBtn = screen.getByRole('button', { name: 'Submit Offering' });

    expect(submitBtn).toBeDisabled();
    
    await user.click(checkbox);
    
    expect(checkbox).toBeChecked();
    expect(submitBtn).toBeEnabled();
  });

  it('submits and hands off to the registration success screen', async () => {
    const user = userEvent.setup();
    renderComponent();

    const checkbox = screen.getByLabelText(/I acknowledge that by submitting this offering/i);
    await user.click(checkbox);

    const submitBtn = screen.getByRole('button', { name: 'Submit Offering' });
    await user.click(submitBtn);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.queryByRole('button', { name: 'Submit Offering' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Review Timeline/i })).toBeInTheDocument();
  });

  it('has accessible acknowledgement checkbox', () => {
    renderComponent();

    const checkbox = screen.getByLabelText(/I acknowledge that by submitting this offering/i);
    expect(checkbox).toHaveAttribute('aria-required', 'true');
  });
});
