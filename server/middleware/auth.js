const jwt = require('jsonwebtoken');

const auth = async (req, res, next) => {
  try {
    console.log('🔐 Auth middleware called for:', req.method, req.url);
    console.log('🔐 Request headers:', {
      'authorization': req.header('Authorization') ? 'Bearer ***' : 'none',
      'content-type': req.header('Content-Type'),
      'user-agent': req.header('User-Agent')?.substring(0, 50)
    });
    
    // Get token from header
    const authHeader = req.header('Authorization');
    console.log('🔐 Authorization header:', authHeader ? 'present' : 'missing');
    
    const token = authHeader?.replace('Bearer ', '');
    
    console.log('🔐 Token found:', token ? 'yes' : 'no');
    if (token) {
      console.log('🔐 Token length:', token.length);
      console.log('🔐 Token preview:', token.substring(0, 30) + '...');
    }

    if (!token) {
      console.log('❌ No token in request');
      return res.status(401).json({ error: 'No authentication token, access denied' });
    }

    // Verify token
    console.log('🔐 Verifying token...');
    console.log('🔐 JWT_SECRET set:', process.env.JWT_SECRET ? 'yes' : 'no');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.username = decoded.username;
    
    console.log('✅ Token verified, userId:', decoded.userId, 'username:', decoded.username);
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error.name);
    console.error('❌ Auth middleware error message:', error.message);
    console.error('❌ Auth middleware error stack:', error.stack);
    
    if (error.name === 'JsonWebTokenError') {
      console.log('❌ Token verification failed - invalid token');
      return res.status(401).json({ error: 'Token is not valid' });
    }
    if (error.name === 'TokenExpiredError') {
      console.log('❌ Token verification failed - token expired');
      return res.status(401).json({ error: 'Token has expired' });
    }
    console.error('❌ Unexpected auth error:', error);
    res.status(500).json({ error: 'Server error during authentication' });
  }
};

module.exports = auth;


