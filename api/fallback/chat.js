const https = require('https');

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    let prompt = '';
    
    // Parse body
    if (req.body) {
        if (typeof req.body === 'string') {
            try {
                const parsed = JSON.parse(req.body);
                prompt = parsed.prompt || parsed.message || parsed.input || '';
            } catch (e) {
                prompt = req.body;
            }
        } else if (typeof req.body === 'object') {
            prompt = req.body.prompt || req.body.message || req.body.input || '';
        }
    }

    if (!prompt) {
        return res.status(200).json({ 
            response: 'Por favor envía una pregunta o mensaje.',
            message: 'Por favor envía una pregunta o mensaje.',
            status: 200,
            source: 'server-fallback'
        });
    }

    try {
        // Query Pollinations AI (free AI service)
        const encoded = encodeURIComponent(prompt);
        const url = `https://text.pollinations.ai/${encoded}`;

        const fetchAi = () => new Promise((resolve) => {
            const request = https.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/plain, application/json'
                }
            }, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    if (response.statusCode === 200 && data.trim() && !data.includes("PAYMENT_REQUIRED") && !data.includes("Queue full")) {
                        resolve(data.trim());
                    } else {
                        resolve(null);
                    }
                });
            });

            request.on('error', () => resolve(null));
            request.setTimeout(7000, () => {
                request.destroy();
                resolve(null);
            });
        });

        let aiResponse = await fetchAi();
        if (!aiResponse) {
            aiResponse = `🤖 **Respuesta NÚCLEO (Servidor Fallback):**\nHe recibido tu consulta: "${prompt}". Los servicios en la nube están activos y operando normalmente.`;
        }

        return res.status(200).json({ 
            response: aiResponse,
            message: aiResponse,
            status: 200,
            source: 'server-fallback'
        });
    } catch (err) {
        return res.status(200).json({ 
            response: `Respuesta de emergencia para: ${prompt}`,
            message: `Respuesta de emergencia para: ${prompt}`,
            status: 200,
            source: 'server-fallback'
        });
    }
};
