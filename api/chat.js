const chatFallback = require('./fallback/chat');

module.exports = async (req, res) => {
    return chatFallback(req, res);
};
