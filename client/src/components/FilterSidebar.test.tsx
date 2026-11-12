import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Category } from '../types';
import type { SearchFilters } from '../utils/searchFilters';
import FilterSidebar from './FilterSidebar';

const EMPTY: SearchFilters = { q: '', categories: [], gender: '', region: '', city: '', audiences: [], online: false, page: 1 };
const categories: Category[] = [
  { id: '1', name: 'חרדה', slug: 'anxiety' },
  { id: '2', name: 'טראומה', slug: 'trauma' },
];
const cities = [
  { name: 'חיפה', count: 3 },
  { name: 'עכו', count: 1 },
];

function setup(filters: Partial<SearchFilters> = {}, activeCount = 0) {
  const onChange = vi.fn();
  const onClear = vi.fn();
  render(<FilterSidebar filters={{ ...EMPTY, ...filters }} categories={categories} cities={cities} activeCount={activeCount} onChange={onChange} onClear={onClear} />);
  return { onChange, onClear, user: userEvent.setup() };
}

describe('FilterSidebar', () => {
  it('lists the categories as checkboxes and reflects the selected ones', () => {
    setup({ categories: ['trauma'] });
    expect(screen.getByRole('checkbox', { name: 'חרדה' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'טראומה' })).toBeChecked();
  });

  it('selecting a category adds it to the others already selected', async () => {
    const { onChange, user } = setup({ categories: ['trauma'] });
    await user.click(screen.getByRole('checkbox', { name: 'חרדה' }));
    expect(onChange).toHaveBeenCalledWith({ categories: ['trauma', 'anxiety'] });
  });

  it('unselecting a category removes just that one', async () => {
    const { onChange, user } = setup({ categories: ['trauma', 'anxiety'] });
    await user.click(screen.getByRole('checkbox', { name: 'טראומה' }));
    expect(onChange).toHaveBeenCalledWith({ categories: ['anxiety'] });
  });

  it('offers "all", male and female for gender, and reports the choice', async () => {
    const { onChange, user } = setup();
    expect(screen.getByRole('radio', { name: 'הכל' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'מטפלת (אישה)' }));
    expect(onChange).toHaveBeenCalledWith({ gender: 'FEMALE' });
    await user.click(screen.getByRole('radio', { name: 'מטפל (גבר)' }));
    expect(onChange).toHaveBeenCalledWith({ gender: 'MALE' });
  });

  it('reports the region chosen in the dropdown, and "all regions" clears it', async () => {
    const { onChange, user } = setup({ region: 'NORTH' });
    const select = screen.getByLabelText('אזור');
    expect(select).toHaveValue('NORTH');
    await user.selectOptions(select, 'CENTER');
    expect(onChange).toHaveBeenCalledWith({ region: 'CENTER' });
    await user.selectOptions(select, '');
    expect(onChange).toHaveBeenCalledWith({ region: '' });
  });

  it('toggles target audiences independently', async () => {
    const { onChange, user } = setup({ audiences: ['TEENS'] });
    await user.click(screen.getByRole('checkbox', { name: 'זוגות' }));
    expect(onChange).toHaveBeenCalledWith({ audiences: ['TEENS', 'COUPLES'] });
    await user.click(screen.getByRole('checkbox', { name: 'בני נוער' }));
    expect(onChange).toHaveBeenCalledWith({ audiences: [] });
  });

  it('toggles the online filter', async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole('checkbox', { name: 'מטפלים שמקבלים גם אונליין' }));
    expect(onChange).toHaveBeenCalledWith({ online: true });
  });

  it('applies the city once, after the typing pause, and not on every keystroke', async () => {
    const { onChange, user } = setup();
    await user.type(screen.getByLabelText('עיר'), 'חיפה');
    expect(onChange).not.toHaveBeenCalled(); // still inside the pause
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ city: 'חיפה' }), { timeout: 2000 });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('shows the current city and suggests the cities that really have therapists', () => {
    setup({ city: 'עכו' });
    expect(screen.getByLabelText('עיר')).toHaveValue('עכו');
    const options = [...document.querySelectorAll('#city-options option')].map((o) => (o as HTMLOptionElement).value);
    expect(options).toEqual(['חיפה', 'עכו']);
  });

  it('keeps the city box in step when the filter is cleared from outside', () => {
    const { rerender } = (() => {
      const onChange = vi.fn();
      const r = render(<FilterSidebar filters={{ ...EMPTY, city: 'חיפה' }} categories={categories} cities={cities} activeCount={1} onChange={onChange} onClear={vi.fn()} />);
      return { rerender: (f: SearchFilters) => r.rerender(<FilterSidebar filters={f} categories={categories} cities={cities} activeCount={0} onChange={onChange} onClear={vi.fn()} />) };
    })();
    expect(screen.getByLabelText('עיר')).toHaveValue('חיפה');
    rerender(EMPTY);
    expect(screen.getByLabelText('עיר')).toHaveValue('');
  });

  describe('clear-all button', () => {
    it('is hidden when nothing is selected', () => {
      setup();
      expect(screen.queryByRole('button', { name: 'ניקוי הכל' })).not.toBeInTheDocument();
    });

    it('appears when something is selected and clears everything', async () => {
      const { onClear, user } = setup({ online: true }, 1);
      await user.click(screen.getByRole('button', { name: 'ניקוי הכל' }));
      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });

  describe('on a phone', () => {
    it('starts collapsed and opens with the "advanced filter" button', async () => {
      const { user } = setup();
      const toggle = screen.getByRole('button', { name: /סינון מתקדם/ });
      const panel = document.getElementById('filters-panel') as HTMLElement;
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(panel).toHaveClass('hidden');

      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(panel).toHaveClass('block');
      expect(panel).not.toHaveClass('hidden');

      await user.click(toggle);
      expect(panel).toHaveClass('hidden');
    });

    it('shows how many options are selected on the button', () => {
      setup({ categories: ['anxiety'], online: true }, 2);
      expect(screen.getByRole('button', { name: /סינון מתקדם/ })).toHaveTextContent('2');
    });

    it('shows no badge when nothing is selected', () => {
      setup();
      expect(screen.getByRole('button', { name: /סינון מתקדם/ })).not.toHaveTextContent(/\d/);
    });
  });
});
