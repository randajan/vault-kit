import { toFn } from "../tools";
import { VaultPort } from "./VaultPort";
import { VaultPrivate } from "./VaultPrivate";

/**
 * @preserve
 *
 * @typedef {"init"|"push"|"pull"|"error"|"ready"|"expired"|"destroyed"} VaultStatus
 */

/**
 * @preserve
 *
 * Event context passed to vault listeners.
 *
 * @typedef {Object} VaultContext
 * @property {VaultStatus} status Current cell status.
 * @property {*} [data] Current cached data.
 * @property {Error} [error] Current error.
 * @property {{ status?:VaultStatus, data?:* }} [before] Previous cell snapshot.
 */

/**
 * @preserve
 *
 * @callback VaultListener
 * @param {VaultContext} ctx
 * @param {...*} args Cell id and extra arguments passed through the operation.
 */

/**
 * @preserve
 *
 * @callback RemoteSetter
 * @param {*} data Data received from a passive remote update.
 * @param {...*} args Cell id and extra arguments.
 * @returns {Promise<*>}
 */

/**
 * @preserve
 *
 * Remote adapter used by a vault.
 *
 * @typedef {Object} VaultRemoteOptions
 * @property {number} [timeout=5000] Timeout for pull and push in milliseconds. Use 0 to disable wrapping.
 * @property {Function} [init] Passive-sync setup. Receives a RemoteSetter; its return value is passed to destroy.
 * @property {Function} pull Reads from the remote source.
 * @property {Function} [push] Writes to the remote source. Missing push makes the vault readonly.
 * @property {Function} [destroy] Cleans up resources.
 * @property {boolean} [preserveAction] Keeps the action envelope after local actions run.
 */

/**
 * @preserve
 *
 * Main vault configuration.
 *
 * @typedef {Object} VaultOptions
 * @property {boolean} [depth=0] Enables multiple addressed cells.
 * @property {boolean} [readonly=false] Blocks set and act calls.
 * @property {VaultRemoteOptions} [remote] Remote pull/push/init adapter.
 * @property {number} [ttl=0] Time-to-live in milliseconds. Use 0 to disable expiry.
 * @property {Object.<string, Function>} [actions] Local action handlers.
 * @property {(error:Error)=>*} [actionsCatch] Converts local action errors into data.
 * @property {Function|string} [unfold] Extracts cached data from set/push results.
 * @property {(data:*, result:*)=>*} [trait] Transforms data before it is stored.
 * @property {(oldData:*)=>void} [purge] Runs before old cached data is discarded.
 * @property {(emit:VaultListener, ctx:VaultContext, ...args:*)=>void} [emitter] Custom event dispatcher.
 */

export const _privates = new WeakMap();

/**
 * @preserve
 *
 * Public vault facade.
 *
 * A vault owns cached cells, optional remote synchronization, action dispatch,
 * event subscriptions, and lifecycle cleanup.
 */
export class Vault extends VaultPort {

    /**
     * @preserve
     *
     * @param {VaultOptions} [options={}] Vault configuration.
     */
    constructor(options={}) {
        const _vault = new VaultPrivate(options);
        super(_vault);
    }

    at(...path) {
        const _vault = _privates.get(this);
        return new VaultPort(_vault, path);
    }

}
