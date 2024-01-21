export declare class ConsulConnector {
    startRegister(conf: {
        [key: string]: any;
    }, pmId?: number | undefined): void;
    deregister: (conf: {
        [key: string]: any;
    }) => void;
}
