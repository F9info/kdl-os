import { describe, it, expect } from 'vitest';
import { render, screen } from '../utils';
import { ErrorAlert } from '@/components/shared/ErrorAlert';

describe('ErrorAlert regression', () => {
  it('renders nothing when error is falsy', () => {
    render(<ErrorAlert error={null} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('displays a string error message directly', () => {
    render(<ErrorAlert error="Something broke" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something broke');
  });

  it('extracts nested axios-style error message', () => {
    const error = { response: { data: { message: 'Bad request' } } };
    render(<ErrorAlert error={error} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Bad request');
  });

  it('falls back to error.message when available', () => {
    const error = new Error('Fallback message');
    render(<ErrorAlert error={error} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Fallback message');
  });

  it('shows the default message for unknown errors', () => {
    render(<ErrorAlert error={{ unknown: true }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'An unexpected error occurred'
    );
  });
});
