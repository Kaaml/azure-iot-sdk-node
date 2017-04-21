/// <reference types="node" />
import { EventEmitter } from 'events';
import { results, Message, Receiver } from 'azure-iot-common';
export interface HttpReceiverOptions {
    interval?: number;
    at?: Date;
    cron?: string;
    manualPolling?: boolean;
    drain?: boolean;
}
/**
 * @class module:azure-iot-device-http.HttpReceiver
 * @classdesc Provides a receiver link that can pull messages from the IoT Hub service and settle them.
 *
 * @param {Object}  config            This is a dictionary containing the
 *                                    following keys and values:
 *
 * | Key     | Value                                                   |
 * |---------|---------------------------------------------------------|
 * | host    | The host URL of the Azure IoT Hub                       |
 * | hubName | The name of the Azure IoT Hub                           |
 * | keyName | The identifier of the device that is being connected to |
 * | key     | The shared access key auth                              |
 *
 * @emits message When a message is received
 * @emits errorReceived When there was an error trying to receive messages
 */
/**
 * @event module:azure-iot-device-http.HttpReceiver#errorReceived
 * @type {Error}
 */
/**
 * @event module:azure-iot-device-http.HttpReceiver#message
 * @type {Message}
 */
export declare class HttpReceiver extends EventEmitter implements Receiver {
    private _config;
    private _http;
    private _opts;
    private _cronObj;
    private _intervalObj;
    private _timeoutObj;
    private _receiverStarted;
    constructor(config: any, httpHelper: any);
    /**
     * @method          module:azure-iot-device-http.HttpReceiver#receive
     * @description     The receive method queries the IoT Hub immediately (as the device indicated in the
     *                  `config` constructor parameter) for the next message in the queue.
     */
    receive(): void;
    /**
     * @method          module:azure-iot-device-http.HttpReceiver#setOptions
     * @description     This method sets the options defining how the receiver object should poll the IoT Hub service to get messages.
     *                  There is only one instance of the receiver object. If the receiver has already been created, calling setOptions will
     *                  change the options of the existing instance and restart it.
     *
     * @param {Object} opts Receiver options formatted as: { interval: (Number), at: (Date), cron: (string), drain: (Boolean) }
     */
    setOptions(opts?: HttpReceiverOptions): void;
    /**
     * @method          module:azure-iot-device-http.HttpReceiver#updateSharedAccessSignature
     * @description     Sets the SAS Token used for authentication with the IoT Hub service when receiving messages.
     */
    updateSharedAccessSignature(sharedAccessSignature: string): void;
    /**
     * @method          module:azure-iot-device-http.HttpReceiver#complete
     * @description     Sends a completion message to the IoT Hub service, effectively removing the message from the queue and flagging it as succesfully delivered.
     */
    complete(message: Message, done?: (err?: Error, result?: results.MessageCompleted) => void): void;
    /**
     * @method          module:azure-iot-device-http.HttpReceiver#abandon
     * @description     Sends an abandon message to the IoT Hub service. The message remains in the queue and the service will retry delivering it.
     */
    abandon(message: Message, done?: (err?: Error, result?: results.MessageAbandoned) => void): void;
    /**
     * @method          module:azure-iot-device-http.HttpReceiver#reject
     * @description     Sends a rejection message to the IoT Hub service, effectively removing the message from the queue and flagging it as rejected.
     */
    reject(message: Message, done?: (err?: Error, result?: results.MessageRejected) => void): void;
    private _insertAuthHeaderIfNecessary(headers);
    private _startReceiver();
    private _stopReceiver();
    /**
     * This method sends the feedback action to the IoT Hub.
     *
     * @param {String}  action    This parameter must be equal to one of the
     *                            following possible values:
     *
     * | Value    | Action                                                                                  |
     * |----------|-----------------------------------------------------------------------------------------|
     * | abandon  | Directs the IoT Hub to re-enqueue a message so it may be received again later.          |
     * | reject   | Directs the IoT Hub to delete a message from the queue and record that it was rejected. |
     * | complete | Directs the IoT Hub to delete a message from the queue and record that it was accepted. |
     *
     * @param {String}        message   The message for which feedback is being sent.
     * @param {Function}      done      The callback to be invoked when
     *                                  `sendFeedback` completes execution.
     */
    private _sendFeedback(action, message, done);
}
