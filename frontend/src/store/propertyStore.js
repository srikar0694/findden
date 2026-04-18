import { create } from 'zustand';
import { propertiesService } from '../services/properties.service';

export const usePropertyStore = create((set, get) => ({
  properties: [],
  total: 0,
  page: 1,
  loading: false,
  error: null,
  activeFilters: {},
  selectedPropertyId: null,

  setFilters: (filters) => set({ activeFilters: filters, page: 1 }),

  setSelectedProperty: (id) => set({ selectedPropertyId: id }),

  fetchProperties: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const res = await propertiesService.search({ ...get().activeFilters, ...params });
      set({
        properties: res.data,
        total: res.meta?.total || 0,
        loading: false,
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchMoreProperties: async (params = {}) => {
    const nextPage = get().page + 1;
    set({ loading: true, error: null });
    try {
      const res = await propertiesService.search({ ...get().activeFilters, ...params, page: nextPage });
      set((state) => ({
        properties: [...state.properties, ...res.data],
        total: res.meta?.total || state.total,
        page: nextPage,
        loading: false,
      }));
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },
}));
