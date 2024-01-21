import pm2 from "pm2";
import {ConsulConnector} from "./consulConnector";
import promClient from "prom-client";
import IO from "@pm2/io";
import express from "express";
import type { Request, Response } from 'express';
import {queryParser} from "express-query-parser";

const AggregatorRegistry = promClient.AggregatorRegistry
const GET_METRICS_REQ = 'prom:getMetricsReq'
const GET_METRICS_RES = 'prom:getMetricsRes'
let requestCtr = 0
const requests = new Map<number, IRequest>();
const consulConnector = new ConsulConnector()

interface IRequest {
    responses: any[];
    done: (err: Error, result: any) => void;
    errorTimeout: NodeJS.Timeout;
    failed: boolean;
    pending?: number;
}

// fix https://github.com/keymetrics/pm2-io-apm/issues/260
const io = IO.init()
const conf = (io.getConfig() as any).module_conf as { [key: string]: any }

io.initModule({
    widget: {
        // Logo displayed
        logo: 'https://app.keymetrics.io/img/logo/keymetrics-300.png',
        // Module colors
        // 0 = main element
        // 1 = secondary
        // 2 = main border
        // 3 = secondary border
        theme: ['#141A1F', '#222222', '#3ff', '#3ff'],
        // Section to show / hide
        el: {
            probes: true,
            actions: true
        },
        // Main block to show / hide
        block: {
            actions: false,
            issues: true,
            meta: true,
        }
    },
}, function (err: Error) {
    if (err) return console.error(err)

    const appNames = (conf.app_name as string).split(',').map(name => name.trim());
    const sendWokerRequest = (id: number, requestId: number) => {
        pm2.sendDataToProcessId(id, {
            id: id,
            type: GET_METRICS_REQ,
            data: {
                requestId
            },
            topic: 'Get worker metrics'
        }, err => {
            if (err) console.error('send worker message error', err)
        })
    }

    const requestIndexHandler = (req: Request, res: Response) => {
        res.statusCode = 404
        return res.end()
    }
    const requestOnlineHandler = (req: Request, res: Response) => {
        return res.end('ok');
    }
    const requestHandler = (req: Request, res: Response) => {
        const query = req.query;
        const requestId = requestCtr++

        const done = (err: Error, result: any) => {
            if (err) {
                return res.end(err.message)
            }

            res.writeHead(200, {'Content-Type': promClient.register.contentType})
            res.end(result)
        }


        const request: IRequest = {
            responses: [],
            done,
            errorTimeout: setTimeout(() => {
                request.failed = true
                request.done(new Error('time out'), () => {
                })
                clearTimeout(request.errorTimeout);
                requests.delete(requestId)
            }, 5000),
            failed: false
        }


        if (query.pm_id) {
            request.pending = 1
            requests.set(requestId, request)

            sendWokerRequest(Number(query.pm_id), requestId)
        } else {
            pm2.list((err, apps) => {
                if (err) return res.end(err.message)

                const workers = apps.filter(app => {
                    return typeof (app.pm2_env as any).axm_options.isModule === 'undefined'
                      && appNames.includes(app.name)
                })

                if (workers.length === 0) return setImmediate(() => done(null, 'no metrics'))

                request.pending = workers.length
                requests.set(requestId, request)

                workers.forEach(worker => {
                    sendWokerRequest(worker.pm_id, requestId)
                })
            })
        }
    }

    pm2.launchBus((err, bus) => {
        bus.on(GET_METRICS_RES, async (message: {data: { requestId: number, metrics: any }}) => {
            const request = requests.get(message.data.requestId);
            if (!request) return;

            request.responses.push(message.data.metrics);
            request.pending--;

            if (request.pending === 0) {
                while (requests.size > conf.limit ?? 10000) { // Assuming a default limit of 100000
                    const oldestKey = requests.keys().next().value;
                    clearTimeout(requests.get(oldestKey).errorTimeout);
                    requests.delete(oldestKey);
                }

                clearTimeout(request.errorTimeout);
                requests.delete(message.data.requestId);

                if (request.failed) return;

                try {
                    const registry = AggregatorRegistry.aggregate(request.responses);
                    const promString = await registry.metrics();
                    request.done(null, promString);
                } catch (err) {
                    console.error(err);
                    request.done(err, null);
                }
            }
        });
    });

    const app = express()
    app.use(io.expressErrorHandler())
    app.use(
      queryParser({
          parseNull: true,
          parseUndefined: true,
          parseBoolean: true,
          parseNumber: true
      })
    )
    app.use((req, res, next) => {
        const authHeader = req.headers.authorization ?? req.query.token ?? null;
        const authToken = conf.auth_token ?? '';
        if(authToken !== '' && conf.auth_token !== authHeader) {
            res.statusCode = 404
            return res.end()
        }
        next();
    });

    app.use('/online', requestOnlineHandler)
    app.use('/metrics', requestHandler)
    app.get('/', requestIndexHandler);

    app.listen(conf.port, function () {
        console.log('app listening on port ' + conf.host + ':' + conf.port + '!');

        if (conf.register_mode === 'cluster') {
            consulConnector.startRegister(conf)
        } else {
            if (consulConnector) consulConnector.deregister(conf)

            pm2.list((err, apps) => {
                if (err) {
                    console.error(err.message);
                    return;
                }

                const workers = apps.filter(app => {
                    return typeof (app.pm2_env as any).axm_options.isModule === 'undefined'
                      && conf.appName.indexOf(app.name) !== -1
                })

                workers.forEach(worker => {
                    consulConnector.startRegister(conf, worker.pm_id)
                })
            })
        }
    });
})
