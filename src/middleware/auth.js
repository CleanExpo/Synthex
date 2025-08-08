/**
 * Authentication Middleware
 * Handles JWT validation, role-based access, and team permissions
 */

const jwt = require('jsonwebtoken');
const config = require('../../config/app.config');

// Main authentication middleware
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No valid authentication token provided'
      });
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Attach user to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || [],
      tenantId: decoded.tenantId
    };

    // Check if token is about to expire and refresh if needed
    const tokenExp = decoded.exp * 1000;
    const now = Date.now();
    const timeUntilExpiry = tokenExp - now;
    
    // If token expires in less than 5 minutes, add refresh header
    if (timeUntilExpiry < 5 * 60 * 1000) {
      res.setHeader('X-Token-Refresh-Required', 'true');
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token Expired',
        message: 'Your authentication token has expired'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid Token',
        message: 'The provided token is invalid'
      });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication Error',
      message: 'An error occurred during authentication'
    });
  }
};

// Role-based authorization middleware
const authorize = (requiredRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    // Admin always has access
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user has required role
    if (requiredRoles.length > 0 && !requiredRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource'
      });
    }

    next();
  };
};

// Team access middleware
const checkTeamAccess = (requiredRoles = []) => {
  return async (req, res, next) => {
    try {
      const teamId = req.params.teamId;
      
      if (!teamId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Team ID is required'
        });
      }

      // In production, this would check database for team membership
      // For now, we'll do a simple check
      const userTeams = req.user.teams || [];
      const teamMembership = userTeams.find(t => t.id === teamId);

      if (!teamMembership) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You are not a member of this team'
        });
      }

      // Check team role if required
      if (requiredRoles.length > 0 && !requiredRoles.includes(teamMembership.role)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient team permissions'
        });
      }

      req.team = {
        id: teamId,
        role: teamMembership.role,
        permissions: teamMembership.permissions
      };

      next();
    } catch (error) {
      console.error('Team access check error:', error);
      return res.status(500).json({
        error: 'Internal Error',
        message: 'Failed to verify team access'
      });
    }
  };
};

// Device authorization middleware
const authorizeDevice = async (req, res, next) => {
  try {
    const deviceId = req.params.deviceId || req.body.deviceId || req.query.deviceId;
    
    if (!deviceId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Device ID is required'
      });
    }

    // Check device ownership
    // In production, this would verify device belongs to user
    req.device = {
      id: deviceId,
      userId: req.user.id
    };

    next();
  } catch (error) {
    console.error('Device authorization error:', error);
    return res.status(500).json({
      error: 'Internal Error',
      message: 'Failed to authorize device'
    });
  }
};

// Tenant authorization middleware
const authorizeTenant = (requiredRoles = []) => {
  return async (req, res, next) => {
    try {
      const tenantId = req.params.tenantId || req.user.tenantId;
      
      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Tenant ID is required'
        });
      }

      // Check tenant access
      if (req.user.tenantId !== tenantId && req.user.role !== 'superadmin') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this tenant'
        });
      }

      // Check tenant role if required
      if (requiredRoles.length > 0) {
        const userTenantRole = req.user.tenantRole || req.user.role;
        if (!requiredRoles.includes(userTenantRole)) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Insufficient tenant permissions'
          });
        }
      }

      req.tenant = {
        id: tenantId,
        role: req.user.tenantRole || req.user.role
      };

      next();
    } catch (error) {
      console.error('Tenant authorization error:', error);
      return res.status(500).json({
        error: 'Internal Error',
        message: 'Failed to authorize tenant access'
      });
    }
  };
};

// Admin authorization middleware
const authorizeAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required'
    });
  }
  next();
};

// API key authentication middleware
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    
    if (!apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key required'
      });
    }

    // In production, validate API key from database
    // For now, we'll do a simple check
    if (apiKey.length < 32) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    }

    req.apiKey = {
      key: apiKey,
      permissions: ['read', 'write'] // Would come from database
    };

    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    return res.status(500).json({
      error: 'Internal Error',
      message: 'Failed to authenticate API key'
    });
  }
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwt.secret);
    
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || []
    };
  } catch (error) {
    // Silent fail - continue without authentication
    console.log('Optional auth failed:', error.message);
  }
  
  next();
};

module.exports = {
  authenticate,
  authorize,
  checkTeamAccess,
  authorizeDevice,
  authorizeTenant,
  authorizeAdmin,
  authenticateApiKey,
  optionalAuth
};