const db = require('../config/database');

const TABLE = 'messages';

const MessageModel = {
  findAll: () => db.findAll(TABLE),

  findById: (id) => db.findById(TABLE, id),

  findBySenderId: (userId) =>
    db.findWhere(TABLE, (m) => m.sender_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),

  findByPropertyId: (propertyId) =>
    db.findWhere(TABLE, (m) => m.property_id === propertyId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),

  countSentInWindow: (userId, sinceIsoDate) => {
    const cutoff = new Date(sinceIsoDate).getTime();
    return db.count(TABLE, (m) =>
      m.sender_id === userId && new Date(m.created_at).getTime() >= cutoff
    );
  },

  /** Distinct property IDs the user has messaged or contacted. */
  contactedPropertyIds: (userId) => {
    const ids = new Set();
    db.findWhere(TABLE, (m) => m.sender_id === userId)
      .forEach((m) => ids.add(m.property_id));
    return Array.from(ids);
  },

  /**
   * Distinct property IDs with the most-recent message timestamp the user
   * sent for each — used by the dashboard "Contacted" tab.
   * Returns: [{propertyId, lastContactedAt}], newest first.
   */
  contactedSummary: (userId) => {
    const map = new Map(); // propertyId → ISO timestamp (latest)
    db.findWhere(TABLE, (m) => m.sender_id === userId).forEach((m) => {
      const prev = map.get(m.property_id);
      if (!prev || new Date(m.created_at) > new Date(prev)) {
        map.set(m.property_id, m.created_at);
      }
    });
    return Array.from(map.entries())
      .map(([propertyId, lastContactedAt]) => ({ propertyId, lastContactedAt }))
      .sort((a, b) => new Date(b.lastContactedAt) - new Date(a.lastContactedAt));
  },

  create: (data) =>
    db.insert(TABLE, {
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
};

module.exports = MessageModel;
