import { create } from 'zustand';
import { wishlistService } from '../services/wishlist.service';

/**
 * Wishlist + Unlock Cart store.
 *
 * Two responsibilities:
 *   1. Mirror the server-side wishlist (/api/wishlist) for the current user.
 *   2. Track a *local* "unlock cart" — the subset of properties the user has
 *      selected to pay for in one shot (max 30, the Premium plan cap).
 */
export const useWishlistStore = create((set, get) => ({
  items: [],       // rich objects returned by /wishlist
  ids: new Set(),  // set of propertyIds currently wishlisted (fast lookup)
  cart: [],        // array of propertyIds staged for bulk unlock
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await wishlistService.list();
      const wishlistIds = new Set(data.map((w) => w.propertyId));
      set({
        items: data,
        ids: wishlistIds,
        loading: false,
      });
      return { success: true };
    } catch (err) {
      console.error('Failed to fetch wishlist:', err);
      set({ error: err.message, loading: false });
      return { success: false, error: err.message };
    }
  },

  add: async (propertyId, notes = null) => {
    try {
      // Optimistically update the UI
      const ids = new Set(get().ids);
      ids.add(propertyId);
      set({ ids });

      // Make the API call
      await wishlistService.add(propertyId, notes);

      // Sync with server to ensure consistency
      await get().fetch();
      return { success: true };
    } catch (err) {
      // Rollback optimistic update on error
      const ids = new Set(get().ids);
      ids.delete(propertyId);
      set({ ids });
      console.error('Failed to add to wishlist:', err);
      return { success: false, error: err.message };
    }
  },

  remove: async (propertyId) => {
    try {
      // Optimistically update the UI
      const ids = new Set(get().ids);
      ids.delete(propertyId);
      set({
        ids,
        items: get().items.filter((w) => w.propertyId !== propertyId),
        cart: get().cart.filter((id) => id !== propertyId),
      });

      // Make the API call
      await wishlistService.remove(propertyId);

      // Sync with server to ensure consistency
      await get().fetch();
      return { success: true };
    } catch (err) {
      // Rollback optimistic update on error
      console.error('Failed to remove from wishlist:', err);
      await get().fetch(); // Sync with server to restore correct state
      return { success: false, error: err.message };
    }
  },

  toggle: async (propertyId) => {
    return get().ids.has(propertyId)
      ? get().remove(propertyId)
      : get().add(propertyId);
  },

  has: (propertyId) => get().ids.has(propertyId),

  // ---- Unlock Cart (client-side selection for bulk checkout) ------------
  addToCart: (propertyId) => {
    const cart = get().cart;
    if (cart.includes(propertyId)) return;
    set({ cart: [...cart, propertyId] });
  },

  removeFromCart: (propertyId) => {
    set({ cart: get().cart.filter((id) => id !== propertyId) });
  },

  clearCart: () => set({ cart: [] }),

  isInCart: (propertyId) => get().cart.includes(propertyId),
}));
