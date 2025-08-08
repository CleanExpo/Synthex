/**
 * SYNTHEX 2.0 Feature Flags Configuration
 * Progressive rollout and A/B testing control
 */

const Redis = require('ioredis');
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD
});

class FeatureFlags {
  constructor() {
    this.flags = {
      // Core Features - Stable
      analyticsD