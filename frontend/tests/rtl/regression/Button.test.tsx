import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../utils';
import { Button } from '@/components/ui/button';

describe('Button regression', () => {
  it('renders a clickable button with text', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('supports asChild rendering', () => {
    const { container } = render(
      <Button asChild>
        <a href="/home">Home</a>
      </Button>
    );

    const link = container.querySelector('a[href="/home"]');
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent('Home');
  });

  it('respects disabled state', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button', { name: /disabled/i })).toBeDisabled();
  });
});
