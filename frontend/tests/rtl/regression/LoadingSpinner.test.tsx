import { describe, it, expect } from 'vitest';
import { render, screen } from '../utils';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

describe('LoadingSpinner regression', () => {
  it('renders a status element with default size', () => {
    render(<LoadingSpinner />);
    const spinner = screen.getByRole('status', { name: /loading/i });
    expect(spinner).toBeInTheDocument();
  });

  it('renders children with a full-page overlay', () => {
    render(<LoadingSpinner fullPage />);
    const spinner = screen.getByRole('status', { name: /loading/i });
    expect(spinner).toBeInTheDocument();
    expect(spinner.parentElement).toHaveClass('fixed');
  });
});
