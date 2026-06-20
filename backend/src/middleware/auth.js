function extractOperator(req, res, next) {
  const operator = req.headers['x-operator'] || req.headers['operator'];
  const role = req.headers['x-role'] || req.headers['x-user-role'] || req.headers['role'];
  
  req.operator = operator || null;
  req.role = role || null;
  next();
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.operator) {
      return res.status(400).json({ error: '缺少审核人信息，请在请求头中携带 x-operator' });
    }
    const role = req.role;
    if (!role) {
      return res.status(400).json({ error: '缺少角色信息，请在请求头中携带 x-role' });
    }
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: `权限不足，需要角色：${allowedRoles.join('、')}，当前角色：${role}` });
    }
    next();
  };
}

module.exports = {
  extractOperator,
  requireRole
};
