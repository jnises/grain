// Production environment configuration for profiling
// This ensures devAssert and other dev-only code is eliminated

// Set NODE_ENV to production to ensure production optimizations
process.env.NODE_ENV = 'production';

export const isProductionMode = true;
