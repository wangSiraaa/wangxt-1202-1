function extractOperator(req, res, next) {
  const operator = req.headers['x-operator'] || req.headers['operator'];
  const role = req.headers['x-role'] || req.headers['x-user-role'] || req.headers['role'];
  
  req.operator = operator || null;
  req.role = role || null;
  next();
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    const role = req.role;
    if (!role) {
      return res.status(400).json({ error: '请指定角色' });
    }
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: `权限不足，需要角色：${allowedRoles.join('、')}` });
    }
    next();
  };
}

module.exports = {
  extractOperator,
  requireRole
};
