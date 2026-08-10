import { toFn } from "../tools";
import { VaultPort } from "./VaultPort";
import { VaultPrivate } from "./VaultPrivate";

/**
 * @preserve
 *
 * @typedef {"init"|"push"|"pull"|"error"|"ready"|"expired"} VaultStatus
 */

/**
 * @preserve
 *
 * Event context passed to vault listeners.
 *
 * Operation extra fields are copied directly onto the context.
 *
 * @typedef {Object} VaultContext
 * @property {VaultStatus} status Current cell status.
 * @property {*} [data] Current cached data.
 * @property {Error} [error] Current error.
 * @property {{ status?:VaultStatus, data?:* }} [before] Previous cell snapshot.
 * @property {Array} path Cell path.
 */

/**
 * @preserve
 *
 * @callback VaultListener
 * @param {VaultContext} ctx
 */

/**
 * @preserve
 *
 * @callback RemoteSetter
 * @param {*} data Data received from a passive remote update.
 * @param {Array} [path=[]] Target cell path. Required for addressed vaults.
 * @param {Object} [extra={}] Custom fields added to the emitted context.
 * @returns {Promise<*>}
 */

/**
 * @preserve
 *
 * Packet passed to remote pull and push handlers.
 *
 * Operation extra fields are copied directly onto the packet.
 *
 * @typedef {Object} VaultRemotePacket
 * @property {Array} path Cell path.
 * @property {*} [data] Data being pushed.
 * @property {()=>*|Promise<*>} [pull] Helper available during push to read remote data for the same path.
 */

/**
 * @preserve
 *
 * Remote adapter used by a vault.
 *
 * @typedef {Object} VaultRemoteOptions
 * @property {number} [timeout=5000] Timeout for pull and push in milliseconds. Use 0 to disable wrapping.
 * @property {(packet:VaultRemotePacket)=>*|Promise<*>} pull Reads from the remote source.
 * @property {(packet:VaultRemotePacket)=>*|Promise<*>} [push] Writes to the remote source. Missing push makes the vault readonly.
 * @property {boolean} [preserveAction] Keeps the action envelope after local actions run. Required when remote and actions are used together.
 */

/**
 * @preserve
 *
 * Main vault configuration.
 *
 * @typedef {Object} VaultOptions
 * @property {boolean} [hasMany=false] Enables one path segment.
 * @property {number} [depth=0] Number of required path segments. Overrides hasMany when greater than 0.
 * @property {boolean} [readonly=false] Blocks set and act calls.
 * @property {VaultRemoteOptions} [remote] Remote pull/push adapter.
 * @property {(set:RemoteSetter)=>void} [init] Passive-sync setup.
 * @property {number} [ttl=0] Time-to-live in milliseconds. Use 0 to disable expiry.
 * @property {Object.<string, Function>} [actions] Local action handlers.
 * @property {(error:Error)=>*} [actionsCatch] Converts local action errors into data.
 * @property {Function|string} [unfold] Extracts cached data from set/push results.
 * @property {(data:*, result:*)=>*} [trait] Transforms data before it is stored.
 * @property {(oldData:*)=>void} [purge] Runs before old cached data is discarded.
 * @property {(emit:VaultListener, ctx:VaultContext)=>void} [emitter] Custom event dispatcher.
 */

export const _privates = new WeakMap();

/**
 * @preserve
 *
 * Public vault facade.
 *
 * A vault owns cached cells, optional remote synchronization, action dispatch,
 * event subscriptions, and cache expiry.
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

}
