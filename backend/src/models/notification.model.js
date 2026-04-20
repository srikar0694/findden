/**
 * Notification Model
 * ----------------------------------------------------------------------
 * A generic log of outbound notifications (email / SMS) sent to
 * property owners on behalf of interested buyers/renters.
 *
 * type:       'request_callback' | 'send_message'
 * channels:   array combination of 'email' | 'sms'
 * status:     'queued' | 'sent' | 'failed'
 *
 * In dev we don't actually hit an SMTP/SMS gateway — the notifier
 * simply logs a fully-formed payload here. A production deployment
 * can swap the transport without changing the API surface.
 */

const db = require('../config/database');

const TABLE = 'notifications';

const NotificationModel = {
  create: (row) => db.insert(TABLE, row),

  findById: (id) => db.findById(TABLE, id),

  findByOwnerId: (ownerId) =>
    db.findWhere(TABLE, (n) => n.owner_id === ownerId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),

  findBySenderId: (senderId) =>
    db.findWhere(TABLE, (n) => n.sender_id === senderId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),

  updateStatus: (id, status) => db.updateById(TABLE, id, { status }),
};

module.exports = NotificationModel;
