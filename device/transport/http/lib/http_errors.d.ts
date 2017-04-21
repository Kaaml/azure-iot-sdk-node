/// <reference types="node" />
import { IncomingMessage } from 'http';
export declare class HttpTransportError extends Error {
    response?: IncomingMessage;
    responseBody?: any;
}
export declare function translateError(message: string, body: any, response: IncomingMessage): HttpTransportError;
