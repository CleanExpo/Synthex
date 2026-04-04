/**
 * Base Controller Template
 * Provides common functionality for all controllers
 */

class BaseController {
  constructor(serviceName) {
    this.serviceName = serviceName;
  }

  /**
   * Generic create handler
   */
  async create(req, res) {
    try {
      const { userId } = req.user || { userId: 'demo' };
      const data = req.body;
      
      const result = {
        id: `${this.serviceName}_${Date.now()}`,
        userId,
        ...data,
        createdAt: new Date().toISOString()
      };
      
      res.status(201).json({
        success: true,
        data: result,
        message: `${this.serviceName} created successfully`
      });
    } catch (error) {
      console.error(`Error in ${this.serviceName} create:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to create ${this.serviceName}`
      });
    }
  }

  /**
   * Generic get all handler
   */
  async getAll(req, res) {
    try {
      const { userId } = req.user || { userId: 'demo' };
      const { page = 1, limit = 10 } = req.query;
      
      // Mock data
      const items = Array.from({ length: 5 }, (_, i) => ({
        id: `${this.serviceName}_${i + 1}`,
        name: `${this.serviceName} Item ${i + 1}`,
        status: 'active',
        createdAt: new Date().toISOString()
      }));
      
      res.json({
        success: true,
        data: items,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: items.length
        }
      });
    } catch (error) {
      console.error(`Error in ${this.serviceName} getAll:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to fetch ${this.serviceName} items`
      });
    }
  }

  /**
   * Generic get by ID handler
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      const item = {
        id,
        name: `${this.serviceName} Item`,
        description: `This is a ${this.serviceName} item`,
        status: 'active',
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      res.json({
        success: true,
        data: item
      });
    } catch (error) {
      console.error(`Error in ${this.serviceName} getById:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to fetch ${this.serviceName}`
      });
    }
  }

  /**
   * Generic update handler
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const updated = {
        id,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      res.json({
        success: true,
        data: updated,
        message: `${this.serviceName} updated successfully`
      });
    } catch (error) {
      console.error(`Error in ${this.serviceName} update:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to update ${this.serviceName}`
      });
    }
  }

  /**
   * Generic delete handler
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      res.json({
        success: true,
        message: `${this.serviceName} deleted successfully`,
        data: { id }
      });
    } catch (error) {
      console.error(`Error in ${this.serviceName} delete:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to delete ${this.serviceName}`
      });
    }
  }
}

module.exports = BaseController;