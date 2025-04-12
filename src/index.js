
import { VaultMany } from "./VaultMany";
import { VaultOne } from "./VaultOne";

export { VaultMany, VaultOne }

export default (hasMany, options={})=>hasMany ? new VaultMany(options) : new VaultOne(options);
