const jwt = require('jsonwebtoken');

function authToken(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'missing or malformed authorization header' });
    }
 
    const token = header.slice('Bearer '.length);
 
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { id: payload.sub, email: payload.email, artistName: payload.artistName };
        return next();
    } catch (err) {
        return res.status(401).json({ error: 'invalid or expired token' });
    }
}
 
module.exports = { authToken };
 