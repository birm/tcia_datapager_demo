import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearURL, initURL, updateURL } from '../services/URLServices';

beforeEach(() => {
  window.history.replaceState({}, '', '/');
});

describe('updateURL', () => {
  it('sets filterState in search params', () => {
    const filters = [{ id: 'f1', field: 'gender', operation: 'eq', values: 'M' }];
    updateURL(filters);
    const params = new URLSearchParams(window.location.search);
    expect(JSON.parse(params.get('filterState'))).toEqual(filters);
  });

  it('calls clearURL when filters is empty', () => {
    updateURL([{ id: 'f1', field: 'gender', operation: 'eq', values: 'M' }]);
    updateURL([]);
    const params = new URLSearchParams(window.location.search);
    expect(params.get('filterState')).toBeNull();
  });
});

describe('clearURL', () => {
  it('removes filterState from URL', () => {
    updateURL([{ id: 'f1', field: 'gender', operation: 'eq', values: 'M' }]);
    clearURL();
    const params = new URLSearchParams(window.location.search);
    expect(params.get('filterState')).toBeNull();
  });
});

describe('initURL', () => {
  it('calls addFilters with parsed filters and calls removeAll first', () => {
    const filters = [{ id: 'f1', field: 'gender', operation: 'eq', values: 'M' }];
    window.history.replaceState({}, '', `/?filterState=${encodeURIComponent(JSON.stringify(filters))}`);
    const addFilters = vi.fn();
    const removeAll = vi.fn();
    initURL(addFilters, removeAll);
    expect(removeAll).toHaveBeenCalledOnce();
    expect(addFilters).toHaveBeenCalledWith(filters);
  });

  it('ignores malformed JSON', () => {
    window.history.replaceState({}, '', '/?filterState=not-valid-json{{{');
    const addFilters = vi.fn();
    initURL(addFilters, vi.fn());
    expect(addFilters).not.toHaveBeenCalled();
  });

  it('ignores filters with invalid operations', () => {
    const bad = [{ id: 'f1', field: 'gender', operation: 'INVALID', values: 'M' }];
    window.history.replaceState({}, '', `/?filterState=${encodeURIComponent(JSON.stringify(bad))}`);
    const addFilters = vi.fn();
    initURL(addFilters, vi.fn());
    expect(addFilters).not.toHaveBeenCalled();
  });

  it('ignores filters with missing values', () => {
    const bad = [{ id: 'f1', field: 'gender', operation: 'eq' }];
    window.history.replaceState({}, '', `/?filterState=${encodeURIComponent(JSON.stringify(bad))}`);
    const addFilters = vi.fn();
    initURL(addFilters, vi.fn());
    expect(addFilters).not.toHaveBeenCalled();
  });

  it('does nothing when filterState param is absent', () => {
    const addFilters = vi.fn();
    initURL(addFilters, vi.fn());
    expect(addFilters).not.toHaveBeenCalled();
  });
});
