"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var pm2_1 = __importDefault(require("pm2"));
var consulConnector_1 = require("./consulConnector");
var prom_client_1 = __importDefault(require("prom-client"));
var io_1 = __importDefault(require("@pm2/io"));
var express_1 = __importDefault(require("express"));
var express_query_parser_1 = require("express-query-parser");
var AggregatorRegistry = prom_client_1.default.AggregatorRegistry;
var GET_METRICS_REQ = 'prom:getMetricsReq';
var GET_METRICS_RES = 'prom:getMetricsRes';
var requestCtr = 0;
var requests = new Map();
var consulConnector = new consulConnector_1.ConsulConnector();
// fix https://github.com/keymetrics/pm2-io-apm/issues/260
var io = io_1.default.init();
var conf = io.getConfig().module_conf;
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
}, function (err) {
    var _this = this;
    if (err)
        return console.error(err);
    var appNames = conf.app_name.split(',').map(function (name) { return name.trim(); });
    var sendWokerRequest = function (id, requestId) {
        pm2_1.default.sendDataToProcessId(id, {
            id: id,
            type: GET_METRICS_REQ,
            data: {
                requestId: requestId
            },
            topic: 'Get worker metrics'
        }, function (err) {
            if (err)
                console.error('send worker message error', err);
        });
    };
    var requestOnlineHandler = function (req, res) {
        return res.end('ok');
    };
    var requestHandler = function (req, res) {
        var query = req.query;
        var requestId = requestCtr++;
        var done = function (err, result) {
            if (err) {
                return res.end(err.message);
            }
            res.writeHead(200, { 'Content-Type': prom_client_1.default.register.contentType });
            res.end(result);
        };
        var request = {
            responses: [],
            done: done,
            errorTimeout: setTimeout(function () {
                request.failed = true;
                request.done(new Error('time out'), function () {
                });
                clearTimeout(request.errorTimeout);
                requests.delete(requestId);
            }, 5000),
            failed: false
        };
        if (query.pm_id) {
            request.pending = 1;
            requests.set(requestId, request);
            sendWokerRequest(Number(query.pm_id), requestId);
        }
        else {
            pm2_1.default.list(function (err, apps) {
                if (err)
                    return res.end(err.message);
                var workers = apps.filter(function (app) {
                    return typeof app.pm2_env.axm_options.isModule === 'undefined'
                        && appNames.includes(app.name);
                });
                if (workers.length === 0)
                    return setImmediate(function () { return done(null, 'no metrics'); });
                request.pending = workers.length;
                requests.set(requestId, request);
                workers.forEach(function (worker) {
                    sendWokerRequest(worker.pm_id, requestId);
                });
            });
        }
    };
    pm2_1.default.launchBus(function (err, bus) {
        bus.on(GET_METRICS_RES, function (message) { return __awaiter(_this, void 0, void 0, function () {
            var request, oldestKey, registry, promString, err_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        request = requests.get(message.data.requestId);
                        if (!request)
                            return [2 /*return*/];
                        request.responses.push(message.data.metrics);
                        request.pending--;
                        if (!(request.pending === 0)) return [3 /*break*/, 4];
                        while ((_a = requests.size > conf.limit) !== null && _a !== void 0 ? _a : 10000) { // Assuming a default limit of 100000
                            oldestKey = requests.keys().next().value;
                            clearTimeout(requests.get(oldestKey).errorTimeout);
                            requests.delete(oldestKey);
                        }
                        clearTimeout(request.errorTimeout);
                        requests.delete(message.data.requestId);
                        if (request.failed)
                            return [2 /*return*/];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        registry = AggregatorRegistry.aggregate(request.responses);
                        return [4 /*yield*/, registry.metrics()];
                    case 2:
                        promString = _b.sent();
                        request.done(null, promString);
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _b.sent();
                        console.error(err_1);
                        request.done(err_1, null);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
    });
    var app = (0, express_1.default)();
    app.use((0, express_query_parser_1.queryParser)({
        parseNull: true,
        parseUndefined: true,
        parseBoolean: true,
        parseNumber: true
    }));
    // app.use('/', requestHandler)
    app.use('/online', requestOnlineHandler);
    app.use('/metrics', requestHandler);
    // always add the middleware as the last one
    app.use(io.expressErrorHandler());
    app.listen(conf.port, function () {
        console.log('Example app listening on port ' + conf.port + '!');
        if (conf.register_mode === 'cluster') {
            consulConnector.startRegister(conf);
        }
        else {
            if (consulConnector)
                consulConnector.deregister(conf);
            pm2_1.default.list(function (err, apps) {
                if (err) {
                    console.error(err.message);
                    return;
                }
                var workers = apps.filter(function (app) {
                    return typeof app.pm2_env.axm_options.isModule === 'undefined'
                        && conf.appName.indexOf(app.name) !== -1;
                });
                workers.forEach(function (worker) {
                    consulConnector.startRegister(conf, worker.pm_id);
                });
            });
        }
    });
});
