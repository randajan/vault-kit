import { VaultPort } from "./VaultPort";
import { VaultPrivate } from "./VaultPrivate";

export class Vault extends VaultPort {

    constructor(options={}) {
        super(new VaultPrivate(options));
    }

}
