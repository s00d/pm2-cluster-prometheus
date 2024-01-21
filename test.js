const Prometheus = require("prom-client");
const register = new Prometheus.Registry();

Prometheus.collectDefaultMetrics({ register });
process.on('SIGTERM', () => {
    register.clear();
});

const httpRequestDurationMicroseconds = new Prometheus.Histogram({
    name: 'http_request_duration_ms',
    help: 'Duration of HTTP requests in ms',
    labelNames: ['method', 'route', 'code'],
    buckets: [0.1, 5, 15, 50, 100, 200, 300, 400, 500],
});
register.registerMetric(httpRequestDurationMicroseconds);

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

setInterval(async () => {
    console.log('metric')

    const end = httpRequestDurationMicroseconds.startTimer();
    setTimeout(() => {
        end({ route: 'test', code: 200, method: 'GET' });
    }, 100 + getRandomInt(500))
}, 1000)


process.on('message', async (message) => {
    if (message.type === 'prom:getMetricsReq') {
        console.log('prom:getMetricsReq')
        const metrics = await register.getMetricsAsJSON();
        process.send({
            type: 'prom:getMetricsRes',
            data: {
                requestId: message.data.requestId,
                metrics,
            },
        });
    }
});
