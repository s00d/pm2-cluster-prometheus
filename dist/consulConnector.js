"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsulConnector = void 0;
var address = __importStar(require("address"));
var consul_1 = __importDefault(require("consul"));
var node_os_1 = __importDefault(require("node:os"));
var registerMe = function (conf, consul, pmId) {
    var serviceName = conf.consul_service_name;
    var id = "".concat(serviceName, "-").concat(address.ip(), "-").concat(conf.port);
    var tags = ['pm2-cluster', process.env.NODE_ENV || 'development', 'host_' + node_os_1.default.hostname()];
    if (pmId !== undefined) {
        id += "-".concat(pmId);
        tags.push("pmId_".concat(pmId));
    }
    var service = {
        id: id,
        name: serviceName,
        tags: tags,
        address: address.ip(),
        port: conf.port,
        check: {
            http: "http://".concat(address.ip(), ":").concat(conf.port, "/online"),
            interval: '15s',
            ttl: '60s',
            deregistercriticalserviceafter: '10m'
        }
    };
    consul.agent.service.register(service, function (err) {
        if (err)
            console.error('consul register failed', err);
    });
};
var ConsulConnector = /** @class */ (function () {
    function ConsulConnector() {
        this.deregister = function (conf) {
            var consul_new = (0, consul_1.default)({
                host: conf.consul_host,
                port: conf.consul_port
            });
            var serviceName = conf.consul_service_name;
            var id = "".concat(serviceName, "-").concat(address.ip(), "-").concat(conf.port);
            if (!consul_new.agent && !consul_new.agent.service)
                return;
            consul_new.agent.service.deregister(id, function (err) {
                // if (err) console.error('consul deregister failed', err)
            });
        };
    }
    ConsulConnector.prototype.startRegister = function (conf, pmId) {
        if (pmId === void 0) { pmId = undefined; }
        if (conf.reigster_disabled)
            return;
        var consul = (0, consul_1.default)({
            host: conf.consul_host,
            port: conf.consul_port
        });
        registerMe(conf, consul, pmId);
    };
    return ConsulConnector;
}());
exports.ConsulConnector = ConsulConnector;
