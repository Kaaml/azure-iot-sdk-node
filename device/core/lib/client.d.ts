/// <reference types="node" />
import { Stream } from 'stream';
import { EventEmitter } from 'events';
import { results, Message } from 'azure-iot-common';
import { BlobUploadClient } from './blob_upload';
import { Twin } from './twin';
import { Transport } from './interfaces';
/**
 * @class           module:azure-iot-device.Client
 * @classdesc       Creates an IoT Hub device client. Normally, consumers will
 *                  call the factory method,
 *                  {@link module:azure-iot-device.Client.fromConnectionString|fromConnectionString},
 *                  to create an IoT Hub device client.
 * @param {Object}  transport         An object that implements the interface
 *                                    expected of a transport object, e.g.,
 *                                    {@link module:azure-iot-device~Http|Http}.
 * @param {String}  connStr           A connection string (optional: when not provided, updateSharedAccessSignature must be called to set the SharedAccessSignature token directly).
 * @param {Object}  blobUploadClient  An object that is capable of uploading a stream to a blob.
 */
export declare class Client extends EventEmitter {
    static sasRenewalInterval: number;
    _transport: Transport;
    _twin: Twin;
    private _connectionString;
    private _useAutomaticRenewal;
    private _sasRenewalTimeout;
    private _receiver;
    private _methodCallbackMap;
    private _fsm;
    private _disconnectHandler;
    private blobUploadClient;
    constructor(transport: Transport, connStr?: string, blobUploadClient?: BlobUploadClient);
    /**
     * @method            module:azure-iot-device.Client#onDeviceMethod
     * @description       Registers the `callback` to be invoked when a
     *                    cloud-to-device method call is received by the client
     *                    for the given `methodName`.
     *
     * @param {String}   methodName   The name of the method for which the callback
     *                                is to be registered.
     * @param {Function} callback     The callback to be invoked when the C2D method
     *                                call is received.
     *
     * @throws {ReferenceError}       If the `methodName` or `callback` parameter
     *                                is falsy.
     * @throws {TypeError}            If the `methodName` parameter is not a string
     *                                or if the `callback` is not a function.
     */
    onDeviceMethod(methodName: string, callback: (err?: Error, result?: any) => void): void;
    /**
     * @method            module:azure-iot-device.Client#updateSharedAccessSignature
     * @description       Updates the Shared Access Signature token used by the transport to authenticate with the IoT Hub service.
     *
     * @param {String}   sharedAccessSignature   The new SAS token to use.
     * @param {Function} done       The callback to be invoked when `updateSharedAccessSignature`
     *                              completes execution.
     *
     * @throws {ReferenceError}     If the sharedAccessSignature parameter is falsy.
     * @throws {ReferenceError}     If the client uses x509 authentication.
     */
    updateSharedAccessSignature(sharedAccessSignature: string, updateSasCallback?: (err?: Error, result?: results.SharedAccessSignatureUpdated) => void): void;
    /**
     * @method            module:azure-iot-device.Client#open
     * @description       Call the transport layer CONNECT function if the
     *                    transport layer implements it
     *
     * @param {Function} openCallback  The callback to be invoked when `open`
     *                                 completes execution.
     */
    open(openCallback: (err?: Error, result?: results.Connected) => void): void;
    /**
     * @method            module:azure-iot-device.Client#sendEvent
     * @description       The [sendEvent]{@linkcode Client#sendEvent} method sends an event message
     *                    to the IoT Hub as the device indicated by the connection string passed
     *                    via the constructor.
     *
     * @param {Message}  message            The [message]{@linkcode module:common/message.Message}
     *                                      to be sent.
     * @param {Function} sendEventCallback  The callback to be invoked when `sendEvent`
     *                                      completes execution.
     * @see [Message]{@linkcode module:common/message.Message}
     */
    sendEvent(message: Message, sendEventCallback?: (err?: Error, result?: results.MessageEnqueued) => void): void;
    /**
     * @method            module:azure-iot-device.Client#sendEventBatch
     * @description       The [sendEventBatch]{@linkcode Client#sendEventBatch} method sends a list
     *                    of event messages to the IoT Hub as the device indicated by the connection
     *                    string passed via the constructor.
     *
     * @param {array<Message>} messages               Array of [Message]{@linkcode module:common/message.Message}
     *                                                objects to be sent as a batch.
     * @param {Function}      sendEventBatchCallback  The callback to be invoked when
     *                                                `sendEventBatch` completes execution.
     */
    sendEventBatch(messages: Message[], sendEventBatchCallback?: (err?: Error, result?: results.MessageEnqueued) => void): void;
    /**
     * @method           module:azure-iot-device.Client#close
     * @description      The `close` method directs the transport to close the current connection to the IoT Hub instance
     *
     * @param {Function} closeCallback    The callback to be invoked when the connection has been closed.
     */
    close(closeCallback?: (err?: Error, result?: results.Disconnected) => void): void;
    /**
     * @deprecated      Use Client.setOptions instead.
     * @method          module:azure-iot-device.Client#setTransportOptions
     * @description     The `setTransportOptions` method configures transport-specific options for the client and its underlying transport object.
     *
     * @param {Object}      options     The options that shall be set (see transports documentation).
     * @param {Function}    done        The callback that shall be invoked with either an error or a result object.
     */
    setTransportOptions(options: any, done?: (err?: Error, result?: results.TransportConfigured) => void): void;
    /**
     * @method          module:azure-iot-device.Client#setOptions
     * @description     The `setOptions` method let the user configure the client.
     *
     * @param  {Object}    options  The options structure
     * @param  {Function}  done     The callback that shall be called when setOptions is finished.
     *
     * @throws {ReferenceError}     If the options structure is falsy
     */
    setOptions(options: any, done?: (err?: Error, result?: results.TransportConfigured) => void): void;
    /**
     * @method           module:azure-iot-device.Client#complete
     * @description      The `complete` method directs the transport to settle the message passed as argument as 'completed'.
     *
     * @param {Message}  message           The message to settle.
     * @param {Function} completeCallback  The callback to call when the message is completed.
     *
     * @throws {ReferenceError} If the message is falsy.
     */
    complete(message: Message, completeCallback: (err?: Error, result?: results.MessageCompleted) => void): void;
    /**
     * @method           module:azure-iot-device.Client#reject
     * @description      The `reject` method directs the transport to settle the message passed as argument as 'rejected'.
     *
     * @param {Message}  message         The message to settle.
     * @param {Function} rejectCallback  The callback to call when the message is rejected.
     *
     * @throws {ReferenceException} If the message is falsy.
     */
    reject(message: Message, rejectCallback: (err?: Error, result?: results.MessageRejected) => void): void;
    /**
     * @method           module:azure-iot-device.Client#abandon
     * @description      The `abandon` method directs the transport to settle the message passed as argument as 'abandoned'.
     *
     * @param {Message}  message          The message to settle.
     * @param {Function} abandonCallback  The callback to call when the message is abandoned.
     *
     * @throws {ReferenceException} If the message is falsy.
     */
    abandon(message: Message, abandonCallback: (err?: Error, result?: results.MessageAbandoned) => void): void;
    /**
     * @method           module:azure-iot-device.Client#uploadToBlob
     * @description      The `uploadToBlob` method uploads a stream to a blob.
     *
     * @param {String}   blobName         The name to use for the blob that will be created with the content of the stream.
     * @param {Stream}   stream           The data to that should be uploaded to the blob.
     * @param {Number}   streamLength     The size of the data to that should be uploaded to the blob.
     * @param {Function} done             The callback to call when the upload is complete.
     *
     * @throws {ReferenceException} If blobName or stream or streamLength is falsy.
     */
    uploadToBlob(blobName: string, stream: Stream, streamLength: number, done: (err?: Error) => void): void;
    /**
     * @method           module:azure-iot-device.Client#getTwin
     * @description      The `getTwin` method creates a Twin object and establishes a connection with the Twin service.
     *
     * @param {Function} done             The callback to call when the connection is established.
     *
     */
    getTwin(done: (err?: Error, twin?: Twin) => void, twin: Twin): void;
    private _validateDeviceMethodInputs(methodName, callback);
    private _addMethodCallback(methodName, callback);
    private _connectMessageReceiver();
    private _connectMethodReceiver();
    private _getCurrentReceiver(callback);
    private _disconnectReceiver();
    private _renewSharedAccessSignature();
    private _isImplementedInTransport(fnName);
    /**
     * @method            module:azure-iot-device.Client.fromConnectionString
     * @description       Creates an IoT Hub device client from the given
     *                    connection string using the given transport type.
     *
     * @param {String}    connStr       A connection string which encapsulates "device
     *                                  connect" permissions on an IoT hub.
     * @param {Function}  Transport     A transport constructor.
     *
     * @throws {ReferenceError}         If the connStr parameter is falsy.
     *
     * @returns {module:azure-iothub.Client}
     */
    static fromConnectionString(connStr: string, transportCtor: any): Client;
    /**
     * @method            module:azure-iot-device.Client.fromSharedAccessSignature
     * @description       Creates an IoT Hub device client from the given
     *                    shared access signature using the given transport type.
     *
     * @param {String}    sharedAccessSignature      A shared access signature which encapsulates "device
     *                                  connect" permissions on an IoT hub.
     * @param {Function}  Transport     A transport constructor.
     *
     * @throws {ReferenceError}         If the connStr parameter is falsy.
     *
     * @returns {module:azure-iothub.Client}
     */
    static fromSharedAccessSignature(sharedAccessSignature: string, transportCtor: any): Client;
}
