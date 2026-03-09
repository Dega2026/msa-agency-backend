const RBAC = {
  Founder: {
    can: ['*'],
  },
  Strategist: {
    can: ['strategy:read', 'strategy:write', 'units:read', 'units:write', 'reports:read'],
  },
  Creative: {
    can: ['creative:read', 'creative:write', 'assets:read', 'assets:write'],
  },
  Analyst: {
    can: ['analytics:read', 'reports:read', 'units:read'],
  },
  News: {
    can: ['news:read', 'news:write', 'news:publish', 'reports:read'],
  },
  Growth_Manager: {
    can: ['plans:read', 'plans:write'],
  },
  Operations: {
    can: ['success:read', 'success:write', 'partners:read', 'partners:write'],
  },
};

module.exports = RBAC;
