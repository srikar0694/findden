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
      set({
        items: data,
        ids: new Set(data.map((w) => w.propertyId)),
        loading: false,
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  add: async (propertyId, notes = null) => {
    try {
      await wishlistService.add(propertyId, notes);
      const ids = new Set(get().ids);
      ids.add(propertyId);
      set({ ids });
      await get().fetch();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  remove: async (propertyId) => {
    try {
      await wishlistService.remove(propertyId);
      const ids = new Set(get().ids);
      ids.delete(propertyId);
      set({
        ids,
        items: get().items.filter((w) => w.propertyId !== propertyId),
        cart: get().cart.filter((id) => id !== propertyId),
      });
      return { success: true };
    } catch (err) {
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
