import * as address from "address";
import Consul from "consul";
import os from "node:os";

const registerMe = (conf: {[key: string]: any}, consul: Consul.Consul, pmId: number|undefined) => {
    const serviceName = conf.consul_service_name

    let id = `${serviceName}-${address.ip()}-${conf.port}`
    let tags = ['pm2-cluster', process.env.NODE_ENV || 'development', 'host_' + os.hostname()]

    if (pmId !== undefined) {
        id += `-${pmId}`
        tags.push(`pmId_${pmId}`)
    }

    const service = {
        id: id,
        name: serviceName,
        tags: tags,
        address: address.ip(),
        port: conf.port,
        check: {
            http: `http://${address.ip()}:${conf.port}/online`,
            interval: '15s',
            ttl: '60s',
            deregistercriticalserviceafter: '10m'
        }
    }

    consul.agent.service.register(service, (err: any) => {
        if (err) console.error('consul register failed', err)
    })
}

export class ConsulConnector {
    startRegister(conf: {[key: string]: any}, pmId: number|undefined = undefined) {
        if (conf.reigster_disabled) return

        const consul = Consul({
            host: conf.consul_host,
            port: conf.consul_port
        })

        registerMe(conf, consul, pmId)
    }
    deregister = function (conf: {[key: string]: any}) {
        const consul_new = Consul({
            host: conf.consul_host,
            port: conf.consul_port
        })

        const serviceName = conf.consul_service_name
        let id = `${serviceName}-${address.ip()}-${conf.port}`

        if(!consul_new.agent && !consul_new.agent.service) return;

        consul_new.agent.service.deregister(id, err => {
            // if (err) console.error('consul deregister failed', err)
        })
    }
}
