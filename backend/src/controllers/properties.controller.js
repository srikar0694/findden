const PropertiesService = require('../services/properties.service');
const { success, created, notFound, error } = require('../utils/response');

const PropertiesController = {
  async search(req, res, next) {
    try {
      const result = await PropertiesService.search(req.query, req.user?.id || null);
      return success(res, result.data, result.meta);
    } catch (err) {
      return next(err);
    }
  },

  getById(req, res, next) {
    try {
      const property = PropertiesService.getById(req.params.id, req.user?.id || null);
      if (!property) return notFound(res, 'Property not found');
      return success(res, property);
    } catch (err) {
      return next(err);
    }
  },

  async create(req, res, next) {
    try {
      // Posting is free — no payment gate.
      const property = await PropertiesService.create(req.user.id, req.body);
      return created(res, property);
    } catch (err) {
      return next(err);
    }
  },

  async update(req, res, next) {
    try {
      const property = await PropertiesService.update(
        req.params.id,
        req.user.id,
        req.user.role,
        req.body
      );
      if (!property) return notFound(res, 'Property not found');
      return success(res, property);
    } catch (err) {
      if (err.code === 'FORBIDDEN') return error(res, err.message, 'FORBIDDEN', 403);
      return next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const deleted = await PropertiesService.remove(req.params.id, req.user.id, req.user.role);
      if (!deleted) return notFound(res, 'Property not found');
      return success(res, { message: 'Property deleted' });
    } catch (err) {
      if (err.code === 'FORBIDDEN') return error(res, err.message, 'FORBIDDEN', 403);
      return next(err);
    }
  },

  getMyListings(req, res, next) {
    try {
      const result = PropertiesService.getMyListings(req.user.id, req.query);
      return success(res, result.data, result.meta);
    } catch (err) {
      return next(err);
    }
  },

  async markSold(req, res, next) {
    try {
      const property = await PropertiesService.markSold(
        req.params.id,
        req.user.id,
        req.user.role
      );
      if (!property) return notFound(res, 'Property not found');
      return success(res, property);
    } catch (err) {
      if (err.code === 'FORBIDDEN') return error(res, err.message, 'FORBIDDEN', 403);
      return next(err);
    }
  },

  async quickCreate(req, res, next) {
    try {
      const property = await PropertiesService.quickCreate(req.user.id, req.body);
      return created(res, property);
    } catch (err) {
      return next(err);
    }
  },

  async setVerified(req, res, next) {
    try {
      const property = await PropertiesService.setVerified(
        req.params.id,
        req.user.id,
        req.body.verified !== false,
      );
      if (!property) return notFound(res, 'Property not found');
      return success(res, property);
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = PropertiesController;
