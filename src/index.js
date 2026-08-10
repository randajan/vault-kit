import { Vault } from "./class/Vault";

export { Vault }

/**
 * @preserve
 *
 * Creates a new vault instance.
 *
 * @param {import("./class/Vault").VaultOptions} [options={}] Vault configuration.
 * @returns {Vault}
 */
export default (options={})=>new Vault(options);
