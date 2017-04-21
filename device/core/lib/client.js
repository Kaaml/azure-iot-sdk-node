// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = require("events");
var dbg = require("debug");
var debug = dbg('azure-iot-device.Client');
var machina = require("machina");
var azure_iot_common_1 = require("azure-iot-common");
var connection_string_js_1 = require("./connection_string.js");
var shared_access_signature_js_1 = require("./shared_access_signature.js");
var blob_upload_1 = require("./blob_upload");
var device_method_1 = require("./device_method");
function safeCallback(callback, error, result) {
    if (callback)
        callback(error, result);
}
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
var Client = (function (_super) {
    __extends(Client, _super);
    function Client(transport, connStr, blobUploadClient) {
        var _this = this;
        /*Codes_SRS_NODE_DEVICE_CLIENT_05_001: [The Client constructor shall throw ReferenceError if the transport argument is falsy.]*/
        if (!transport)
            throw new ReferenceError('transport is \'' + transport + '\'');
        _this = _super.call(this) || this;
        /*Codes_SRS_NODE_DEVICE_CLIENT_16_026: [The Client constructor shall accept a connection string as an optional second argument] */
        _this._connectionString = connStr;
        if (_this._connectionString && connection_string_js_1.ConnectionString.parse(_this._connectionString).SharedAccessKey) {
            /*Codes_SRS_NODE_DEVICE_CLIENT_16_027: [If a connection string argument is provided and is using SharedAccessKey authentication, the Client shall automatically generate and renew SAS tokens.] */
            _this._useAutomaticRenewal = true;
            _this._sasRenewalTimeout = setTimeout(_this._renewSharedAccessSignature.bind(_this), Client.sasRenewalInterval);
        }
        else {
            _this._useAutomaticRenewal = false;
        }
        _this.blobUploadClient = blobUploadClient;
        _this._transport = transport;
        _this._receiver = null;
        _this._methodCallbackMap = {};
        _this.on('removeListener', function (eventName) {
            if (_this._receiver && eventName === 'message' && _this.listeners('message').length === 0) {
                _this._disconnectReceiver();
            }
        });
        _this.on('newListener', function (eventName) {
            if (eventName === 'message') {
                /* Schedules startMessageReceiver() on the next tick because the event handler for the
                * 'message' event is only added after this handler (for 'newListener') finishes and
                * the state machine depends on having an event handler on 'message' to determine if
                * it should connect the receiver, depending on its state.
                */
                process.nextTick(function () {
                    _this._fsm.handle('startMessageReceiver');
                });
            }
        });
        var _closeTransport = function (closeCallback) {
            var onDisconnected = function (err, result) {
                _this._fsm.transition('disconnected');
                /*Codes_SRS_NODE_DEVICE_CLIENT_16_056: [The `close` method shall not throw if the `closeCallback` is not passed.]*/
                /*Codes_SRS_NODE_DEVICE_CLIENT_16_055: [The `close` method shall call the `closeCallback` function when done with either a single Error object if it failed or null and a results.Disconnected object if successful.]*/
                safeCallback(closeCallback, err, result);
            };
            if (_this._sasRenewalTimeout) {
                clearTimeout(_this._sasRenewalTimeout);
            }
            if (_this._isImplementedInTransport('disconnect')) {
                /*Codes_SRS_NODE_DEVICE_CLIENT_16_001: [The `close` function shall call the transport's `disconnect` function if it exists.]*/
                _this._transport.disconnect(function (disconnectError, disconnectResult) {
                    /*Codes_SRS_NODE_DEVICE_CLIENT_16_046: [The `close` method shall remove the listener that has been attached to the transport `disconnect` event.]*/
                    _this._transport.removeListener('disconnect', _this._disconnectHandler);
                    onDisconnected(disconnectError, disconnectResult);
                });
            }
            else {
                onDisconnected(null, new azure_iot_common_1.results.Disconnected());
            }
        };
        _this._fsm = new machina.Fsm({
            namespace: 'device-client',
            initialState: 'disconnected',
            states: {
                'disconnected': {
                    open: function (openCallback) {
                        var transportConnectedCallback = function (err, result) {
                            _this._fsm.transition(!!err ? 'disconnected' : 'connected');
                            /*Codes_SRS_NODE_DEVICE_CLIENT_16_060: [The `open` method shall call the `openCallback` callback with a null error object and a `results.Connected()` result object if the transport is already connected, doesn't need to connect or has just connected successfully.]*/
                            safeCallback(openCallback, err, result);
                        };
                        _this._fsm.transition('connecting');
                        if (_this._isImplementedInTransport('connect')) {
                            _this._transport.connect(function (connectErr, connectResult) {
                                /*Codes_SRS_NODE_DEVICE_CLIENT_16_045: [If the transport successfully establishes a connection the `open` method shall subscribe to the `disconnect` event of the transport.]*/
                                _this._transport.removeListener('disconnect', _this._disconnectHandler); // remove the old one before adding a new -- this can happen when renewing SAS tokens
                                _this._transport.on('disconnect', _this._disconnectHandler);
                                transportConnectedCallback(connectErr, connectResult);
                            });
                        }
                        else {
                            transportConnectedCallback(null, new azure_iot_common_1.results.Connected());
                        }
                    },
                    close: function (closeCallback) {
                        /*Codes_SRS_NODE_DEVICE_CLIENT_16_058: [The `close` method shall immediately call the `closeCallback` function if provided and the transport is already disconnected.]*/
                        safeCallback(closeCallback, null, new azure_iot_common_1.results.Disconnected());
                    },
                    updateSharedAccessSignature: function (newSas, updateSasCallback) {
                        _this._transport.updateSharedAccessSignature(newSas, updateSasCallback);
                    },
                    startMessageReceiver: function () {
                        _this._fsm.deferUntilTransition('connected');
                        _this._fsm.handle('open', function (err) {
                            if (err) {
                                /*Codes_SRS_NODE_DEVICE_CLIENT_16_006: [The ‘error’ event shall be emitted when an error occurred within the client code.] */
                                _this.emit('error', err);
                            }
                        });
                    },
                    startMethodReceiver: function () {
                        _this._fsm.deferUntilTransition('connected');
                        _this._fsm.handle('open', function (err) {
                            if (err) {
                                /*Codes_SRS_NODE_DEVICE_CLIENT_16_006: [The ‘error’ event shall be emitted when an error occurred within the client code.] */
                                _this.emit('error', err);
                            }
                        });
                    },
                    getTwin: function (callback) {
                        _this._fsm.deferUntilTransition('connected');
                        _this._fsm.handle('open', function (err) {
                            if (err) {
                                callback(err);
                            }
                        });
                    },
                    '*': function (method, message, callback) {
                        _this._fsm.deferUntilTransition('connected');
                        _this._fsm.handle('open', function (err) {
                            if (err) {
                                callback(err);
                            }
                        });
                    }
                },
                'connecting': {
                    /*Codes_SRS_NODE_DEVICE_CLIENT_16_001: [The `close` function shall call the transport's `disconnect` function if it exists.]*/
                    close: function (closeCallback) {
                        _closeTransport(closeCallback);
                    },
                    '*': function () {
                        _this._fsm.deferUntilTransition();
                    }
                },
                'connected': {
                    _onEnter: function () {
                        /*Codes_SRS_NODE_DEVICE_CLIENT_16_065: [The client shall connect the transport if needed to subscribe receive messages.]*/
                        if (!_this._receiver) {
                            if (_this.listeners('message').length > 0) {
                                _this._connectMessageReceiver();
                            }
                            if (Object.keys(_this._methodCallbackMap).length > 0) {
                                _this._connectMethodReceiver();
                            }
                        }
                    },
                    _onExit: function () {
                        _this._disconnectReceiver();
                        _this._receiver = null;
                    },
                    /*Codes_SRS_NODE_DEVICE_CLIENT_16_060: [The `open` method shall call the `openCallback` callback with a null error object and a `results.Connected()` result object if the transport is already connected, doesn't need to connect or has just connected successfully.]*/
                    open: function (openCallback) {
                        /*Codes_SRS_NODE_DEVICE_CLIENT_16_061: [The `open` method shall not throw if the `openCallback` callback has not been provided.]*/
                        safeCallback(openCallback, null, new azure_iot_common_1.results.Connected());
                    },
                    close: function (closeCallback) {
                        _this._fsm.transition('disconnecting');
                        _closeTransport(function (err, result) {
                            _this._fsm.transition('disconnected');
                            safeCallback(closeCallback, err, result);
                        });
                    },
                    sendEvent: function (msg, sendEventCallback) {
                        /*Codes_SRS_NODE_DEVICE_CLIENT_16_081: [The `sendEvent` method shall throw a `NotImplementedError` if the transport doesn't have that feature.]*/
                        if (_this._isImplementedInTransport('sendEvent')) {
                            _this._transport.sendEvent(msg, function (err, result) {
                                safeCallback(sendEventCallback, err, result);
                            });
                        }
                        else {
                            throw new azure_iot_common_1.errors.NotImplementedError('sendEvent is not supported with this transport');
                        }
                    },
                    sendEventBatch: function (msgBatch, sendEventBatchCallback) {
                        /*Codes_SRS_NODE_DEVICE_CLIENT_16_082: [The `sendEventBatch` method shall throw a `NotImplementedError` if the transport doesn't have that feature.]*/
                        if (_this._isImplementedInTransport('sendEventBatch')) {
                            _this._transport.sendEventBatch(msgBatch, function (err, result) {
                                safeCallback(sendEventBatchCallback, err, result);
                            });
                        }
                        else {
                            throw new azure_iot_common_1.errors.NotImplementedError('sendEventBatch is not supported with this transport');
                        }
                    },
                    updateSharedAccessSignature: function (sharedAccessSignature, updateSasCallback) {
                        _this._fsm.transition('updating_sas');
                        var safeUpdateSasCallback = function (err, result) {
                            if (err) {
                                _this._fsm.transition('disconnected');
                            }
                            else {
                                _this._fsm.transition('connected');
                            }
                            safeCallback(updateSasCallback, err, result);
                        };
                        _this.blobUploadClient.updateSharedAccessSignature(sharedAccessSignature);
                        if (_this._twin) {
                            _this._twin.updateSharedAccessSignature();
                        }
                        /*Codes_SRS_NODE_DEVICE_CLIENT_16_032: [The updateSharedAccessSignature method shall call the updateSharedAccessSignature method of the transport currently inuse with the sharedAccessSignature parameter.]*/
                        _this._transport.updateSharedAccessSignature(sharedAccessSignature, function (err, result) {
                            if (err) {
                                /*Codes_SRS_NODE_DEVICE_CLIENT_16_035: [The updateSharedAccessSignature method shall call the `updateSasCallback` callback with an error object if an error happened while renewng the token.]*/
                                safeUpdateSasCallback(err);
                            }
                            else {
                                debug('sas token updated; needToReconnect: ' + result.needToReconnect);
                                /*Codes_SRS_NODE_DEVICE_CLIENT_16_033: [The updateSharedAccessSignature method shall reconnect the transport to the IoTHub service if it was connected before before the method is clled.]*/
                                /*Codes_SRS_NODE_DEVICE_CLIENT_16_034: [The `updateSharedAccessSignature` method shall not reconnect when the 'needToReconnect' property of the result argument of the callback is false.]*/
                                if (result.needToReconnect) {
                                    _this._fsm.transition('connecting');
                                    _this._transport.connect(function (connectErr) {
                                        if (connectErr) {
                                            safeUpdateSasCallback(connectErr);
                                        }
                                        else {
                                            if (_this._useAutomaticRenewal) {
                                                _this._sasRenewalTimeout = setTimeout(_this._renewSharedAccessSignature.bind(_this), Client.sasRenewalInterval);
                                                /*Codes_SRS_NODE_DEVICE_CLIENT_16_036: [The updateSharedAccessSignature method shall call the `updateSasCallback` callback with a null error object and a result of type SharedAccessSignatureUpdated if the oken was updated successfully.]*/
                                            }
                                            safeUpdateSasCallback(null, new azure_iot_common_1.results.SharedAccessSignatureUpdated(false));
                                        }
                                    });
                                }
                                else {
                                    if (_this._useAutomaticRenewal) {
                                        _this._sasRenewalTimeout = setTimeout(_this._renewSharedAccessSignature.bind(_this), Client.sasRenewalInterval);
                                        /*Codes_SRS_NODE_DEVICE_CLIENT_16_036: [The updateSharedAccessSignature method shall call the `updateSasCallback` callback with a null error object and a result of type SharedAccessSignatureUpdated if the oken was updated successfully.]*/
                                    }
                                    safeUpdateSasCallback(null, new azure_iot_common_1.results.SharedAccessSignatureUpdated(false));
                                }
                            }
                        });
                    },
                    complete: function (message, completeCallback) {
                        /*Codes_SRS_NODE_DEVICE_CLIENT_16_078: [The `complete` method shall throw a `NotImplementedError` if the transport doesn't have that feature.]*/
                        if (_this._isImplementedInTransport('complete')) {
                            _this._transport.complete(message, function (err, result) {
                                safeCallback(completeCallback, err, result);
                            });
                        }
                        else {
                            throw new azure_iot_common_1.errors.NotImplementedError('complete is not supported with this transport');
                        }
                    },
                    abandon: function (message, abandonCallback) {
                        /*Codes_SRS_NODE_DEVICE_CLIENT_16_080: [The `abandon` method shall throw a `NotImplementedError` if the transport doesn't have that feature.]*/
                        if (_this._isImplementedInTransport('abandon')) {
                            _this._transport.abandon(message, function (err, result) {
                                safeCallback(abandonCallback, err, result);
                            });
                        }
                        else {
                            throw new azure_iot_common_1.errors.NotImplementedError('abandon is not supported with this transport');
                        }
                    },
                    reject: function (message, rejectCallback) {
                        /*Codes_SRS_NODE_DEVICE_CLIENT_16_079: [The `reject` method shall throw a `NotImplementedError` if the transport doesn't have that feature.]*/
                        if (_this._isImplementedInTransport('reject')) {
                            _this._transport.reject(message, function (err, result) {
                                safeCallback(rejectCallback, err, result);
                            });
                        }
                        else {
                            throw new azure_iot_common_1.errors.NotImplementedError('reject is not supported with this transport');
                        }
                    },
                    startMessageReceiver: function () {
                        /*Codes_SRS_NODE_DEVICE_CLIENT_16_065: [The client shall connect the transport if needed to subscribe receive messages.]*/
                        if (!_this._receiver) {
                            _this._connectMessageReceiver();
                        }
                    },
                    startMethodReceiver: function (methodName, callback) {
                        _this._methodCallbackMap[methodName] = callback;
                        if (!_this._receiver) {
                            _this._connectMethodReceiver();
                        }
                        else {
                            _this._addMethodCallback(methodName, callback);
                        }
                    },
                    getTwin: function (done, twin) {
                        /* Codes_SRS_NODE_DEVICE_CLIENT_18_001: [** The `getTwin` method shall call the `azure-iot-device-core!Twin.fromDeviceClient` method to create the device client object. **]** */
                        /* Codes_SRS_NODE_DEVICE_CLIENT_18_002: [** The `getTwin` method shall pass itself as the first parameter to `fromDeviceClient` and it shall pass the `done` method as the second parameter. **]**  */
                        /* Codes_SRS_NODE_DEVICE_CLIENT_18_003: [** The `getTwin` method shall use the second parameter (if it is not falsy) to call `fromDeviceClient` on. **]**    */
                        (twin || require('./twin.js')).fromDeviceClient(_this, done);
                    }
                },
                'disconnecting': {
                    '*': function () {
                        _this._fsm.deferUntilTransition();
                    }
                },
                'updating_sas': {
                    close: function (closeCallback) {
                        _this._fsm.transition('disconnecting');
                        _closeTransport(function (err, result) {
                            _this._fsm.transition('disconnected');
                            closeCallback(err, result);
                        });
                    },
                    '*': function () {
                        _this._fsm.deferUntilTransition();
                    }
                }
            }
        });
        _this._fsm.on('transition', function (data) {
            _this.emit('_' + data.toState);
            debug('Client state change: ' + data.fromState + ' -> ' + data.toState + ' (action: ' + data.action + ')');
        });
        _this._disconnectHandler = function (err) {
            _this._fsm.transition('disconnected');
            _this.emit('disconnect', new azure_iot_common_1.results.Disconnected(err));
        };
        return _this;
    }
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
    Client.prototype.onDeviceMethod = function (methodName, callback) {
        // validate input args
        this._validateDeviceMethodInputs(methodName, callback);
        // Codes_SRS_NODE_DEVICE_CLIENT_13_003: [ The client shall start listening for method calls from the service whenever there is a listener subscribed for a method callback. ]
        this._fsm.handle('startMethodReceiver', methodName, callback);
    };
    /*Codes_SRS_NODE_DEVICE_CLIENT_05_016: [When a Client method encounters an error in the transport, the callback function (indicated by the done argument) shall be invoked with the following arguments:
    err - the standard JavaScript Error object, with a response property that points to a transport-specific response object, and a responseBody property that contains the body of the transport response.]*/
    /*Codes_SRS_NODE_DEVICE_CLIENT_05_017: [With the exception of receive, when a Client method completes successfully, the callback function (indicated by the done argument) shall be invoked with the following arguments:
    err - null
    response - a transport-specific response object]*/
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
    Client.prototype.updateSharedAccessSignature = function (sharedAccessSignature, updateSasCallback) {
        var _this = this;
        /*Codes_SRS_NODE_DEVICE_CLIENT_16_031: [The updateSharedAccessSignature method shall throw a ReferenceError if the sharedAccessSignature parameter is falsy.]*/
        if (!sharedAccessSignature)
            throw new ReferenceError('sharedAccessSignature is falsy');
        if (this._useAutomaticRenewal)
            debug('calling updateSharedAccessSignature while using automatic sas renewal');
        /*Codes_SRS_NODE_DEVICE_CLIENT_06_002: [The `updateSharedAccessSignature` method shall throw a `ReferenceError` if the client was created using x509.]*/
        if (this._connectionString && connection_string_js_1.ConnectionString.parse(this._connectionString).x509)
            throw new ReferenceError('client uses x509');
        this._fsm.handle('updateSharedAccessSignature', sharedAccessSignature, function (err, result) {
            if (!err) {
                _this.emit('_sharedAccessSignatureUpdated');
            }
            safeCallback(updateSasCallback, err, result);
        });
    };
    /**
     * @method            module:azure-iot-device.Client#open
     * @description       Call the transport layer CONNECT function if the
     *                    transport layer implements it
     *
     * @param {Function} openCallback  The callback to be invoked when `open`
     *                                 completes execution.
     */
    Client.prototype.open = function (openCallback) {
        this._fsm.handle('open', openCallback);
    };
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
    Client.prototype.sendEvent = function (message, sendEventCallback) {
        /*Codes_SRS_NODE_DEVICE_CLIENT_05_007: [The sendEvent method shall send the event indicated by the message argument via the transport associated with the Client instance.]*/
        this._fsm.handle('sendEvent', message, sendEventCallback);
    };
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
    Client.prototype.sendEventBatch = function (messages, sendEventBatchCallback) {
        /*Codes_SRS_NODE_DEVICE_CLIENT_05_008: [The sendEventBatch method shall send the list of events (indicated by the messages argument) via the transport associated with the Client instance.]*/
        this._fsm.handle('sendEventBatch', messages, sendEventBatchCallback);
    };
    /**
     * @method           module:azure-iot-device.Client#close
     * @description      The `close` method directs the transport to close the current connection to the IoT Hub instance
     *
     * @param {Function} closeCallback    The callback to be invoked when the connection has been closed.
     */
    Client.prototype.close = function (closeCallback) {
        this._fsm.handle('close', closeCallback);
    };
    /**
     * @deprecated      Use Client.setOptions instead.
     * @method          module:azure-iot-device.Client#setTransportOptions
     * @description     The `setTransportOptions` method configures transport-specific options for the client and its underlying transport object.
     *
     * @param {Object}      options     The options that shall be set (see transports documentation).
     * @param {Function}    done        The callback that shall be invoked with either an error or a result object.
     */
    Client.prototype.setTransportOptions = function (options, done) {
        /*Codes_SRS_NODE_DEVICE_CLIENT_16_024: [The ‘setTransportOptions’ method shall throw a ‘ReferenceError’ if the options object is falsy] */
        if (!options)
            throw new ReferenceError('options cannot be falsy.');
        /*Codes_SRS_NODE_DEVICE_CLIENT_16_025: [The ‘setTransportOptions’ method shall throw a ‘NotImplementedError’ if the transport doesn’t implement a ‘setOption’ method.] */
        if (typeof this._transport.setOptions !== 'function')
            throw new azure_iot_common_1.errors.NotImplementedError('setOptions does not exist on this transport');
        var clientOptions = {
            http: {
                receivePolicy: options
            }
        };
        /*Codes_SRS_NODE_DEVICE_CLIENT_16_021: [The ‘setTransportOptions’ method shall call the ‘setOptions’ method on the transport object.]*/
        this._transport.setOptions(clientOptions, function (err) {
            if (err) {
                done(err);
            }
            else {
                done(null, new azure_iot_common_1.results.TransportConfigured());
            }
        });
    };
    /**
     * @method          module:azure-iot-device.Client#setOptions
     * @description     The `setOptions` method let the user configure the client.
     *
     * @param  {Object}    options  The options structure
     * @param  {Function}  done     The callback that shall be called when setOptions is finished.
     *
     * @throws {ReferenceError}     If the options structure is falsy
     */
    Client.prototype.setOptions = function (options, done) {
        /*Codes_SRS_NODE_DEVICE_CLIENT_16_042: [The `setOptions` method shall throw a `ReferenceError` if the options object is falsy.]*/
        if (!options)
            throw new ReferenceError('options cannot be falsy.');
        this._transport.setOptions(options, function (err) {
            /*Codes_SRS_NODE_DEVICE_CLIENT_16_043: [The `done` callback shall be invoked no parameters when it has successfully finished setting the client and/or transport options.]*/
            /*Codes_SRS_NODE_DEVICE_CLIENT_16_044: [The `done` callback shall be invoked with a standard javascript `Error` object and no result object if the client could not be configured as requested.]*/
            if (done) {
                done(err);
            }
        });
    };
    /**
     * @method           module:azure-iot-device.Client#complete
     * @description      The `complete` method directs the transport to settle the message passed as argument as 'completed'.
     *
     * @param {Message}  message           The message to settle.
     * @param {Function} completeCallback  The callback to call when the message is completed.
     *
     * @throws {ReferenceError} If the message is falsy.
     */
    Client.prototype.complete = function (message, completeCallback) {
        /*Codes_SRS_NODE_DEVICE_CLIENT_16_016: [The ‘complete’ method shall throw a ReferenceError if the ‘message’ parameter is falsy.] */
        if (!message)
            throw new ReferenceError('message is \'' + message + '\'');
        this._fsm.handle('complete', message, completeCallback);
    };
    /**
     * @method           module:azure-iot-device.Client#reject
     * @description      The `reject` method directs the transport to settle the message passed as argument as 'rejected'.
     *
     * @param {Message}  message         The message to settle.
     * @param {Function} rejectCallback  The callback to call when the message is rejected.
     *
     * @throws {ReferenceException} If the message is falsy.
     */
    Client.prototype.reject = function (message, rejectCallback) {
        /*Codes_SRS_NODE_DEVICE_CLIENT_16_018: [The reject method shall throw a ReferenceError if the ‘message’ parameter is falsy.] */
        if (!message)
            throw new ReferenceError('message is \'' + message + '\'');
        this._fsm.handle('reject', message, rejectCallback);
    };
    /**
     * @method           module:azure-iot-device.Client#abandon
     * @description      The `abandon` method directs the transport to settle the message passed as argument as 'abandoned'.
     *
     * @param {Message}  message          The message to settle.
     * @param {Function} abandonCallback  The callback to call when the message is abandoned.
     *
     * @throws {ReferenceException} If the message is falsy.
     */
    Client.prototype.abandon = function (message, abandonCallback) {
        /*Codes_SRS_NODE_DEVICE_CLIENT_16_017: [The abandon method shall throw a ReferenceError if the ‘message’ parameter is falsy.] */
        if (!message)
            throw new ReferenceError('message is \'' + message + '\'');
        this._fsm.handle('abandon', message, abandonCallback);
    };
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
    Client.prototype.uploadToBlob = function (blobName, stream, streamLength, done) {
        /*Codes_SRS_NODE_DEVICE_CLIENT_16_037: [The `uploadToBlob` method shall throw a `ReferenceError` if `blobName` is falsy.]*/
        if (!blobName)
            throw new ReferenceError('blobName cannot be \'' + blobName + '\'');
        /*Codes_SRS_NODE_DEVICE_CLIENT_16_038: [The `uploadToBlob` method shall throw a `ReferenceError` if `stream` is falsy.]*/
        if (!stream)
            throw new ReferenceError('stream cannot be \'' + stream + '\'');
        /*Codes_SRS_NODE_DEVICE_CLIENT_16_039: [The `uploadToBlob` method shall throw a `ReferenceError` if `streamLength` is falsy.]*/
        if (!streamLength)
            throw new ReferenceError('streamLength cannot be \'' + streamLength + '\'');
        /*Codes_SRS_NODE_DEVICE_CLIENT_16_040: [The `uploadToBlob` method shall call the `done` callback with an `Error` object if the upload fails.]*/
        /*Codes_SRS_NODE_DEVICE_CLIENT_16_041: [The `uploadToBlob` method shall call the `done` callback no parameters if the upload succeeds.]*/
        this.blobUploadClient.uploadToBlob(blobName, stream, streamLength, done);
    };
    /**
     * @method           module:azure-iot-device.Client#getTwin
     * @description      The `getTwin` method creates a Twin object and establishes a connection with the Twin service.
     *
     * @param {Function} done             The callback to call when the connection is established.
     *
     */
    Client.prototype.getTwin = function (done, twin) {
        this._fsm.handle('getTwin', done, twin);
    };
    Client.prototype._validateDeviceMethodInputs = function (methodName, callback) {
        // Codes_SRS_NODE_DEVICE_CLIENT_13_020: [ onDeviceMethod shall throw a ReferenceError if methodName is falsy. ]
        if (!methodName) {
            throw new ReferenceError('methodName cannot be \'' + methodName + '\'');
        }
        // Codes_SRS_NODE_DEVICE_CLIENT_13_024: [ onDeviceMethod shall throw a TypeError if methodName is not a string. ]
        if (typeof (methodName) !== 'string') {
            throw new TypeError('methodName\'s type is \'' + typeof (methodName) + '\'. A string was expected.');
        }
        // Codes_SRS_NODE_DEVICE_CLIENT_13_022: [ onDeviceMethod shall throw a ReferenceError if callback is falsy. ]
        if (!callback) {
            throw new ReferenceError('callback cannot be \'' + callback + '\'');
        }
        // Codes_SRS_NODE_DEVICE_CLIENT_13_025: [ onDeviceMethod shall throw a TypeError if callback is not a Function. ]
        if (typeof (callback) !== 'function') {
            throw new TypeError('callback\'s type is \'' + typeof (callback) + '\'. A function reference was expected.');
        }
        // Codes_SRS_NODE_DEVICE_CLIENT_13_021: [ onDeviceMethod shall throw an Error if the underlying transport does not support device methods. ]
        if (!(this._transport.sendMethodResponse)) {
            throw new Error('The transport for this client does not support device methods');
        }
        // Codes_SRS_NODE_DEVICE_CLIENT_13_023: [ onDeviceMethod shall throw an Error if a listener is already subscribed for a given method call. ]
        if (!!(this._methodCallbackMap[methodName])) {
            throw new Error('A handler for this method has already been registered with the client.');
        }
    };
    Client.prototype._addMethodCallback = function (methodName, callback) {
        var self = this;
        this._receiver.onDeviceMethod(methodName, function (message) {
            // build the request object
            var request = new device_method_1.DeviceMethodRequest(message.requestId, message.methods.methodName, message.body);
            // build the response object
            var response = new device_method_1.DeviceMethodResponse(message.requestId, self._transport);
            // Codes_SRS_NODE_DEVICE_CLIENT_13_001: [ The onDeviceMethod method shall cause the callback function to be invoked when a cloud-to-device method invocation signal is received from the IoT Hub service. ]
            callback(request, response);
        });
    };
    Client.prototype._connectMessageReceiver = function () {
        var self = this;
        this._getCurrentReceiver(function () {
            debug('Subscribing to message events from the receiver object of the transport');
            self._receiver.on('message', function (msg) {
                self.emit('message', msg);
            });
        });
    };
    Client.prototype._connectMethodReceiver = function () {
        var self = this;
        this._getCurrentReceiver(function () {
            debug('Subscribing to method events from the receiver object of the transport');
            // add listeners for all existing method callbacks
            if (Object.keys(self._methodCallbackMap).length > 0) {
                for (var methodName in self._methodCallbackMap) {
                    if (self._methodCallbackMap.hasOwnProperty(methodName)) {
                        var callback = self._methodCallbackMap[methodName];
                        self._addMethodCallback(methodName, callback);
                    }
                }
            }
        });
    };
    Client.prototype._getCurrentReceiver = function (callback) {
        var self = this;
        this._transport.getReceiver(function (err, receiver) {
            if (!err && receiver !== self._receiver) {
                self._receiver = receiver;
                /*Codes_SRS_NODE_DEVICE_CLIENT_16_006: [The ‘error’ event shall be emitted when an error occurred within the client code.] */
                self._receiver.on('errorReceived', function (err) {
                    self.emit('error', err);
                });
                callback();
            }
            else {
                throw new Error('Transport failed to start receiving messages: ' + err.message);
            }
        });
    };
    Client.prototype._disconnectReceiver = function () {
        if (this._receiver) {
            this._receiver.removeAllListeners('message');
            this._receiver = null;
        }
    };
    Client.prototype._renewSharedAccessSignature = function () {
        var _this = this;
        var cn = connection_string_js_1.ConnectionString.parse(this._connectionString);
        var sas = shared_access_signature_js_1.SharedAccessSignature.create(cn.HostName, cn.DeviceId, cn.SharedAccessKey, azure_iot_common_1.anHourFromNow());
        this._fsm.handle('updateSharedAccessSignature', sas.toString(), function (err) {
            if (err) {
                /*Codes_SRS_NODE_DEVICE_CLIENT_16_006: [The ‘error’ event shall be emitted when an error occurred within the client code.] */
                _this.emit('error', err);
            }
            else {
                _this.emit('_sharedAccessSignatureUpdated');
            }
        });
    };
    Client.prototype._isImplementedInTransport = function (fnName) {
        return typeof this._transport[fnName] === 'function';
    };
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
    Client.fromConnectionString = function (connStr, transportCtor) {
        /*Codes_SRS_NODE_DEVICE_CLIENT_05_003: [The fromConnectionString method shall throw ReferenceError if the connStr argument is falsy.]*/
        if (!connStr)
            throw new ReferenceError('connStr is \'' + connStr + '\'');
        /*Codes_SRS_NODE_DEVICE_CLIENT_05_005: [fromConnectionString shall derive and transform the needed parts from the connection string in order to create a new instance of transportCtor.]*/
        var cn = connection_string_js_1.ConnectionString.parse(connStr);
        var config = {
            host: cn.HostName,
            deviceId: cn.DeviceId,
            hubName: cn.HostName.split('.')[0]
        };
        if (cn.hasOwnProperty('SharedAccessKey')) {
            var sas = shared_access_signature_js_1.SharedAccessSignature.create(cn.HostName, cn.DeviceId, cn.SharedAccessKey, azure_iot_common_1.anHourFromNow());
            config.sharedAccessSignature = sas.toString();
        }
        /*Codes_SRS_NODE_DEVICE_CLIENT_05_006: [The fromConnectionString method shall return a new instance of the Client object, as by a call to new Client(new transportCtor(...)).]*/
        return new Client(new transportCtor(config), connStr, new blob_upload_1.BlobUploadClient(config));
    };
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
    Client.fromSharedAccessSignature = function (sharedAccessSignature, transportCtor) {
        /*Codes_SRS_NODE_DEVICE_CLIENT_16_029: [The fromSharedAccessSignature method shall throw a ReferenceError if the sharedAccessSignature argument is falsy.] */
        if (!sharedAccessSignature)
            throw new ReferenceError('sharedAccessSignature is \'' + sharedAccessSignature + '\'');
        var sas = shared_access_signature_js_1.SharedAccessSignature.parse(sharedAccessSignature);
        var decodedUri = decodeURIComponent(sas.sr);
        var uriSegments = decodedUri.split('/');
        var config = {
            host: uriSegments[0],
            deviceId: uriSegments[uriSegments.length - 1],
            hubName: uriSegments[0].split('.')[0],
            sharedAccessSignature: sharedAccessSignature
        };
        /*Codes_SRS_NODE_DEVICE_CLIENT_16_030: [The fromSharedAccessSignature method shall return a new instance of the Client object] */
        return new Client(new transportCtor(config), null, new blob_upload_1.BlobUploadClient(config));
    };
    return Client;
}(events_1.EventEmitter));
// SAS token created by the client have a lifetime of 60 minutes, renew every 45 minutes
Client.sasRenewalInterval = 2700000;
exports.Client = Client;
//# sourceMappingURL=client.js.map