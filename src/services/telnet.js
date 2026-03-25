// ─── src/services/telnet.js ──────────────────────────────────
// Persistent TCP/Telnet connection to Onyx Manager.
//  • Auto-reconnect on disconnect
//  • Command queue (one command at a time)
//  • Resolves when the "." end-of-response sentinel is received
// ──────────────────────────────────────────────────────────────

const net = require('node:net');
const { EventEmitter } = require('node:events');
const log = require('../utils/logger');

const TAG = 'TelnetClient';

class TelnetClient extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.host = opts.host || process.env.TELNET_HOST || '127.0.0.1';
    this.port = Number(opts.port || process.env.TELNET_PORT || 2323);
    this.timeout = Number(opts.timeout || process.env.TELNET_TIMEOUT || 10) * 1000;
    this.autoReconnect = (opts.autoReconnect ?? process.env.TELNET_AUTO_RECONNECT ?? 'true') === 'true' || opts.autoReconnect === true;
    this.reconnectInterval = Number(opts.reconnectInterval || process.env.TELNET_RECONNECT_INTERVAL || 5) * 1000;

    /** @type {net.Socket|null} */
    this._socket = null;
    this._connected = false;
    this._connecting = false;
    this._destroyed = false;

    // Command queue – serialises commands so we always know which
    // response belongs to which request.
    this._queue = [];
    this._busy = false;

    // Accumulator for the current response
    this._buf = '';
  }

  // ── public ──────────────────────────────────────────────────

  /** Whether the underlying socket is connected. */
  get connected() {
    return this._connected;
  }

  /**
   * Open the connection.  Resolves once the welcome banner has been received.
   * If already connected this is a no-op.
   */
  connect() {
    if (this._connected || this._connecting) return Promise.resolve();
    this._connecting = true;

    return new Promise((resolve, reject) => {
      log.info(TAG, `Connecting to ${this.host}:${this.port} …`);
      const socket = net.createConnection({ host: this.host, port: this.port });

      const onError = (err) => {
        this._connecting = false;
        log.error(TAG, `Connection error: ${err.message}`);
        reject(err);
      };

      socket.once('error', onError);

      // We treat the first incoming data as the welcome banner.
      const bannerBuf = [];
      const onBannerData = (chunk) => {
        bannerBuf.push(chunk.toString());
        const joined = bannerBuf.join('');
        // The banner ends with a standalone "." or "200" on its own line.
        if (/\n\.\s*$/.test(joined) || /\n200\s*$/.test(joined) || /200\r?\n/.test(joined)) {
          socket.removeListener('error', onError);
          socket.removeListener('data', onBannerData);
          this._onConnected(socket, joined.trim());
          resolve();
        }
      };

      socket.on('data', onBannerData);

      // Safety timeout for the banner
      socket.setTimeout(this.timeout, () => {
        // If we got *some* data, consider it connected anyway
        if (bannerBuf.length > 0) {
          socket.removeListener('error', onError);
          socket.removeListener('data', onBannerData);
          this._onConnected(socket, bannerBuf.join('').trim());
          resolve();
        } else {
          socket.destroy();
          this._connecting = false;
          reject(new Error('Timed out waiting for Onyx Manager welcome banner'));
        }
      });
    });
  }

  /**
   * Send a telnet command and return the full response text.
   * Commands are queued so only one is in-flight at a time.
   */
  send(command) {
    return new Promise((resolve, reject) => {
      this._queue.push({ command, resolve, reject });
      this._drain();
    });
  }

  /** Gracefully close the connection. */
  disconnect() {
    this._destroyed = true;
    this.autoReconnect = false;
    if (this._socket) {
      try { this._socket.write('BYE\r\n'); } catch { /* ignore */ }
      this._socket.destroy();
    }
  }

  // ── private ─────────────────────────────────────────────────

  _onConnected(socket, banner) {
    this._socket = socket;
    this._connected = true;
    this._connecting = false;
    log.info(TAG, `Connected to Onyx Manager at ${this.host}:${this.port}`);
    log.debug(TAG, `Banner:\n${banner}`);

    socket.setKeepAlive(true, 30000);
    socket.setTimeout(0); // disable the banner timeout

    socket.on('data', (chunk) => this._onData(chunk));
    socket.on('close', () => this._onClose());
    socket.on('error', (err) => this._onError(err));

    this.emit('connected', banner);
  }

  _onData(chunk) {
    const text = chunk.toString();
    log.rx(text);
    this._buf += text;

    // Onyx Manager terminates every response with a line containing only "."
    // We check for that sentinel to know the response is complete.
    if (this._responseComplete(this._buf)) {
      const response = this._buf;
      this._buf = '';

      if (this._currentCmd) {
        clearTimeout(this._currentCmd._timer);
        this._currentCmd.resolve(response);
        this._currentCmd = null;
        this._busy = false;
        this._drain();
      }
    }
  }

  _responseComplete(text) {
    // The "." on its own line marks the end of a multi-line response.
    // Single-line "200 Ok" responses also end with a newline.
    // We look for a line that is exactly "." (possibly with \r)
    const lines = text.split('\n');
    const last = lines[lines.length - 1].trim();
    const secondLast = lines.length >= 2 ? lines[lines.length - 2].trim() : '';
    return last === '.' || secondLast === '.';
  }

  _onClose() {
    this._connected = false;
    log.warn(TAG, 'Connection closed');

    // Reject any in-flight command
    if (this._currentCmd) {
      this._currentCmd.reject(new Error('Connection closed while waiting for response'));
      this._currentCmd = null;
      this._busy = false;
    }

    // Reject all queued commands
    while (this._queue.length) {
      this._queue.shift().reject(new Error('Connection closed'));
    }

    this.emit('disconnected');

    if (this.autoReconnect && !this._destroyed) {
      log.info(TAG, `Will reconnect in ${this.reconnectInterval / 1000}s …`);
      setTimeout(() => this._reconnect(), this.reconnectInterval);
    }
  }

  _onError(err) {
    log.error(TAG, `Socket error: ${err.message}`);
  }

  async _reconnect() {
    if (this._connected || this._destroyed) return;
    try {
      await this.connect();
    } catch (err) {
      log.error(TAG, `Reconnect failed: ${err.message}`);
      if (this.autoReconnect && !this._destroyed) {
        log.info(TAG, `Retrying in ${this.reconnectInterval / 1000}s …`);
        setTimeout(() => this._reconnect(), this.reconnectInterval);
      }
    }
  }

  /** Process the next command in the queue. */
  _drain() {
    if (this._busy || this._queue.length === 0) return;
    if (!this._connected) {
      // If not connected, reject the head of the queue.
      const item = this._queue.shift();
      item.reject(new Error('Not connected to Onyx Manager'));
      this._drain();
      return;
    }

    this._busy = true;
    const item = this._queue.shift();
    this._currentCmd = item;
    this._buf = '';

    log.tx(item.command);

    // Onyx Manager sometimes needs an extra \r\n to flush.
    // We send the command followed by two CRLFs.
    this._socket.write(`${item.command}\r\n\r\n`);

    // Timeout safety
    item._timer = setTimeout(() => {
      if (this._currentCmd === item) {
        log.warn(TAG, `Command timed out: ${item.command}`);
        // Deliver whatever we have so far
        const partial = this._buf;
        this._buf = '';
        this._currentCmd = null;
        this._busy = false;
        if (partial.length > 0) {
          item.resolve(partial);
        } else {
          item.reject(new Error(`Timed out waiting for response to: ${item.command}`));
        }
        this._drain();
      }
    }, this.timeout);
  }
}

module.exports = TelnetClient;
