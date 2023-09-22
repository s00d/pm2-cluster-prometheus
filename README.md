# pm2-cluster-prometheus-next
PM2 module to aggregate node.js workers' metrics when use pm2 cluster mode

fixes for last version

## Install

```bash
$ pm2 install pm2-cluster-prometheus-next
```
## Configuration
Default settings:

```javascript
  "config": {
    "app_name": "api", // The name of the APP that needs to fetch monitoring data
    "app_group": "book", // Consul service group
    "port": 3000, // Default port for the HTTP service, providing the /metrics and /online interfaces
    "reigster_disabled": false, // Whether to disable service registration to Consul
    "consul_host": "127.0.0.1",
    "consul_port": "8500",
    "register_mode": "cluster" // Default: cluster, other: worker
  }
```
To modify the config values you can use the following commands:
```bash
pm2 set pm2-cluster-prometheus-next:app_name hello
pm2 set pm2-cluster-prometheus-next:port 4000
```
## Mode
"register_mode": "cluster"
get metrics from  http://localhost:3000/metrics

"register_mode": "worker"
get each worker metrics from  http://localhost:3000/metrics?pm_id=1

## Node.js APP
```javascript

// prom-client version require >= 11.0.0
const promClient = require('prom-client')

process.on('message', function (message) {
    if (message.type === 'prom:getMetricsReq') {
        process.send({
            type: 'prom:getMetricsRes',
            data: {
                requestId: message.data.requestId,
                metrics: promClient.register.getMetricsAsJSON()
            }
        })
    }
})
```

## Uninstall

```bash
$ pm2 uninstall pm2-cluster-prometheus-next
```
# License

MIT
