/** A value returned either immediately or through a promise-like object. */
export type MaybePromise<T> = T | PromiseLike<T>;

/** Every lifecycle state a vault cell can have. */
export type VaultStatus =
    | "init"
    | "push"
    | "pull"
    | "error"
    | "ready"
    | "expired"
    | "destroyed";

/** Custom fields copied to event contexts and remote packets. */
export type VaultExtra = Record<string, unknown>;

/** A frozen path identifying a cell in an addressed vault. */
export type VaultPath<TPathSegment = unknown> = readonly TPathSegment[];

/** The previous state included in a change event. */
export interface VaultSnapshot<TData = unknown> {
    readonly status?: VaultStatus;
    readonly data?: TData;
}

/**
 * Event context passed to vault listeners.
 *
 * Operation extra fields are copied directly onto the context. Subtree
 * operations emit a `start` event, an `item` event for every cached cell, and
 * an `end` event containing the collected item contexts.
 */
export type VaultContext<
    TData = unknown,
    TPathSegment = unknown,
    TExtra extends object = VaultExtra
> = TExtra & {
    readonly status: VaultStatus;
    readonly data?: TData;
    readonly error?: Error;
    readonly before?: VaultSnapshot<TData>;
    readonly path: VaultPath<TPathSegment>;
    readonly batch?: "start" | "item" | "end";
    readonly batched?: readonly VaultContext<TData, TPathSegment, TExtra>[];
};

/** A callback subscribed with `on()` or `once()`. */
export type VaultListener<
    TData = unknown,
    TPathSegment = unknown,
    TExtra extends object = VaultExtra
> = (context: VaultContext<TData, TPathSegment, TExtra>) => unknown;

/** Packet passed to iterators created with `forEach()`. */
export type VaultIterationContext<
    TData = unknown,
    TPathSegment = unknown,
    TExtra extends object = VaultExtra
> = TExtra & {
    readonly status: VaultStatus;
    readonly data?: TData;
    readonly error?: Error;
    readonly path: VaultPath<TPathSegment>;
};

/**
 * Packet passed to remote pull and push handlers.
 *
 * Operation extra fields are copied directly onto the packet. `data` and the
 * same-path `pull()` helper are supplied during a push.
 */
export type VaultRemotePacket<
    TWrite = unknown,
    TResult = unknown,
    TPathSegment = unknown,
    TExtra extends object = VaultExtra
> = TExtra & {
    readonly path: VaultPath<TPathSegment>;
    readonly data?: TWrite;
    readonly pull?: () => MaybePromise<TResult>;
};

/**
 * Packet passed to remote destroy handlers and passive-init cleanup functions.
 * Operation extra fields are copied directly onto the packet.
 */
export type VaultDestroyPacket<
    TPathSegment = unknown,
    TExtra extends object = VaultExtra
> = TExtra & {
    readonly path: VaultPath<TPathSegment>;
};

/** Receives data from a passive remote update. */
export type RemoteSetter<
    TData = unknown,
    TPathSegment = unknown,
    TExtra extends object = VaultExtra
> = (
    data: TData,
    path?: readonly TPathSegment[],
    extra?: TExtra
) => Promise<unknown>;

/** Remote pull, push, passive-sync, and cleanup adapter used by a vault. */
export interface VaultRemoteOptions<
    TData = unknown,
    TWrite = TData,
    TResult = TData,
    TPathSegment = unknown,
    TExtra extends object = VaultExtra,
    TInitReturn = unknown
> {
    /**
     * Timeout for pull and push in milliseconds. Defaults to `5000`; `0`
     * preserves the raw remote functions without timeout wrapping. Wrapped
     * timers are cleaned up when the operation settles.
     */
    timeout?: number;

    /** Passive-sync setup. Its return value is passed to `destroy`. */
    init?: (set: RemoteSetter<TData, TPathSegment, TExtra>) => TInitReturn;

    /** Reads data from the remote source. */
    pull: (
        packet: VaultRemotePacket<never, TResult, TPathSegment, TExtra>
    ) => MaybePromise<TResult>;

    /** Writes to the remote source. Omitting it makes the vault readonly. */
    push?: (
        packet: VaultRemotePacket<TWrite, TResult, TPathSegment, TExtra>
    ) => MaybePromise<TResult>;

    /** Cleans up resources owned by the remote adapter. */
    destroy?: (
        packet: VaultDestroyPacket<TPathSegment, TExtra>,
        initReturn: TInitReturn
    ) => unknown;

    /**
     * Keeps `{ action, data }` after a local action runs. This option is
     * required when remote synchronization and local actions are used together.
     */
    preserveAction?: boolean;
}

/** Packet passed to a local action handler. */
export type VaultActionPacket<
    TActionData = unknown,
    TPathSegment = unknown,
    TExtra extends object = VaultExtra
> = TExtra & {
    readonly data: TActionData;
    readonly path: VaultPath<TPathSegment>;
};

/** A local action handler configured in `VaultOptions.actions`. */
export type VaultActionHandler<
    TActionData = unknown,
    TOutput = unknown,
    TPathSegment = unknown,
    TExtra extends object = VaultExtra
> = (
    packet: VaultActionPacket<TActionData, TPathSegment, TExtra>
) => MaybePromise<TOutput>;

/** Named local action handlers. */
export type VaultActions<
    TPathSegment = unknown,
    TExtra extends object = VaultExtra
> = Record<string, VaultActionHandler<any, any, TPathSegment, TExtra>>;

/** Extracts the input data type from a configured action handler. */
export type VaultActionData<THandler> =
    THandler extends (packet: infer TPacket, ...args: any[]) => any
        ? TPacket extends { data: infer TData }
            ? TData
            : unknown
        : unknown;

/** One action function bound to an action name. */
export type VaultBoundAction<
    TData = unknown,
    TResult = unknown,
    TExtra extends object = VaultExtra
> = (data?: TData, extra?: TExtra) => Promise<TResult>;

/** Direct action executor used by `act()` and `withActions()`. */
export type VaultActionExecutor<
    TResult = unknown,
    TExtra extends object = VaultExtra
> = (action: string, data?: unknown, extra?: TExtra) => Promise<TResult>;

/** Property-based action calls inferred from the configured action map. */
export type VaultActionMethods<
    TActions extends VaultActions<any, any>,
    TResult,
    TExtra extends object
> = {
    [TName in keyof TActions]: VaultBoundAction<
        VaultActionData<TActions[TName]>,
        TResult,
        TExtra
    >;
};

/**
 * Callable action dispatcher with property shorthand such as
 * `vault.act.someAction(data, extra)`.
 */
export type VaultActionDispatcher<
    TActions extends VaultActions<any, any> = VaultActions,
    TResult = unknown,
    TExtra extends object = VaultExtra
> = VaultActionExecutor<TResult, TExtra>
    & VaultActionMethods<TActions, TResult, TExtra>;

/** Main vault configuration. */
export interface VaultOptions<
    TData = unknown,
    TWrite = TData,
    TResult = TData,
    TPathSegment = unknown,
    TExtra extends object = VaultExtra,
    TActions extends VaultActions<TPathSegment, TExtra> = VaultActions<TPathSegment, TExtra>,
    TInitReturn = unknown
> {
    /** Enables one path segment. Defaults to `false`. */
    hasMany?: boolean;

    /**
     * Number of required path segments. Defaults to `0` and overrides
     * `hasMany` when greater than zero.
     */
    depth?: number;

    /** Blocks `set()` and action calls. Defaults to `false`. */
    readonly?: boolean;

    /** Remote pull, push, passive-sync, and cleanup adapter. */
    remote?: VaultRemoteOptions<
        TData,
        TWrite,
        TResult,
        TPathSegment,
        TExtra,
        TInitReturn
    >;

    /** Time-to-live in milliseconds. `0` disables expiry. */
    ttl?: number;

    /**
     * Local action handlers behind `vault.act()`. Their results either replace
     * the data in the original action envelope or become direct push data,
     * depending on `remote.preserveAction`.
     */
    actions?: TActions;

    /** Converts a local action error into data. */
    actionsCatch?: (error: Error) => MaybePromise<TWrite>;

    /**
     * Selects cached data from a complete set/push result while the caller
     * still receives the complete result. A property name creates the split
     * automatically; a function returns `[cachedData, completeResult]`.
     */
    unfold?: string | ((result: TResult) => MaybePromise<readonly [TData, TResult]>);

    /** Transforms data immediately before it is stored. */
    trait?: (data: TData, result: TResult) => MaybePromise<TData>;

    /** Runs before old cached data is discarded. */
    purge?: (oldData: TData) => unknown;
}

/**
 * Public interface bound to a vault path.
 *
 * Cell-only methods throw while the port still has child cells. Paths are
 * normalized to frozen arrays and cannot exceed the configured vault depth.
 */
export interface VaultPort<
    TData = unknown,
    TWrite = TData,
    TResult = TData,
    TPathSegment = unknown,
    TExtra extends object = VaultExtra,
    TActions extends VaultActions<TPathSegment, TExtra> = VaultActions<TPathSegment, TExtra>
> {
    /** Path currently bound to this port. */
    readonly path: VaultPath<TPathSegment>;

    /** Number of path segments already bound. */
    readonly level: number;

    /** Number of path segments still required to address a cell. */
    readonly depth: number;

    /** Whether this port still addresses multiple child cells. */
    readonly hasMany: boolean;

    /** Whether the vault has a remote adapter. */
    readonly hasRemote: boolean;

    /** Direct and property-based action dispatcher. */
    readonly act: VaultActionDispatcher<TActions, TResult, TExtra>;

    /** Returns a new port bound to the appended path segments. */
    at(...path: TPathSegment[]): VaultPort<
        TData,
        TWrite,
        TResult,
        TPathSegment,
        TExtra,
        TActions
    >;

    /** Returns the current cell status without starting a remote pull. */
    getStatus(): VaultStatus;

    /** Returns cached data without starting a remote pull. */
    getData(): TData | undefined;

    /** Returns the current cell error, if any. */
    getError(): Error | undefined;

    /** Checks whether the cell has one of the expected statuses. */
    isStatus(statuses: VaultStatus | readonly VaultStatus[]): boolean;

    /** Returns cached data or starts a remote pull when needed. */
    get(extra?: TExtra): Promise<TData | undefined>;

    /** Resolves whether `get()` returns a non-undefined value. */
    has(extra?: TExtra): Promise<boolean>;

    /** Stores data locally or pushes it through the configured remote. */
    set(data: TWrite, extra?: TExtra): Promise<TResult>;

    /** Resets the bound cell or subtree to `init`. */
    reset(extra?: TExtra): this;

    /**
     * Destroys the bound cell or subtree and runs remote cleanup. Destroy is
     * terminal; future access to destroyed cells throws.
     */
    destroy(extra?: TExtra): this;

    /**
     * Iterates cached cells. Untouched init cells in addressed vaults are
     * skipped.
     */
    forEach(
        iterator: (
            context: VaultIterationContext<TData, TPathSegment, TExtra>
        ) => unknown,
        extra?: TExtra
    ): void;

    /** Subscribes to vault changes and returns an unsubscribe function. */
    on(listener: VaultListener<TData, TPathSegment, TExtra>): () => void;

    /** Subscribes to the next vault change and returns an unsubscribe function. */
    once(listener: VaultListener<TData, TPathSegment, TExtra>): () => void;

    /**
     * Adds property-based action calls to a function or object. Missing
     * properties become calls to `execute(property, data, extra)`.
     */
    withActions<TTarget extends object>(
        target: TTarget,
        execute?: VaultActionExecutor<TResult, TExtra>
    ): TTarget & Record<string, VaultBoundAction<unknown, TResult, TExtra>>;
}

/**
 * Public vault facade.
 *
 * A vault owns cached cells, optional remote synchronization, action dispatch,
 * event subscriptions, lifecycle cleanup, and cache expiry.
 */
export class Vault<
    TData = unknown,
    TWrite = TData,
    TResult = TData,
    TPathSegment = unknown,
    TExtra extends object = VaultExtra,
    TActions extends VaultActions<TPathSegment, TExtra> = VaultActions<TPathSegment, TExtra>,
    TInitReturn = unknown
> {
    constructor(options?: VaultOptions<
        TData,
        TWrite,
        TResult,
        TPathSegment,
        TExtra,
        TActions,
        TInitReturn
    >);
}

export interface Vault<
    TData = unknown,
    TWrite = TData,
    TResult = TData,
    TPathSegment = unknown,
    TExtra extends object = VaultExtra,
    TActions extends VaultActions<TPathSegment, TExtra> = VaultActions<TPathSegment, TExtra>,
    TInitReturn = unknown
> extends VaultPort<TData, TWrite, TResult, TPathSegment, TExtra, TActions> {}

/** Creates a new vault instance. */
declare function createVault<
    TData = unknown,
    TWrite = TData,
    TResult = TData,
    TPathSegment = unknown,
    TExtra extends object = VaultExtra,
    TActions extends VaultActions<TPathSegment, TExtra> = VaultActions<TPathSegment, TExtra>,
    TInitReturn = unknown
>(options?: VaultOptions<
    TData,
    TWrite,
    TResult,
    TPathSegment,
    TExtra,
    TActions,
    TInitReturn
>): Vault<TData, TWrite, TResult, TPathSegment, TExtra, TActions, TInitReturn>;

/** Controller returned by the React binding for one vault cell. */
export interface VaultHookPort<
    TData = unknown,
    TWrite = TData,
    TResult = TData,
    TExtra extends object = VaultExtra,
    TActions extends VaultActions<any, TExtra> = VaultActions<any, TExtra>
> {
    /** Current cell status. */
    readonly status: VaultStatus;

    /** Cached data or the previous value while a remote refresh is pending. */
    readonly data: TData | undefined;

    /** Current cell error. */
    readonly error: Error | undefined;

    /** Last result returned by `set()` or an action call. */
    readonly reply: TResult | undefined;

    /** Clears `reply` and redraws the hook consumer. */
    confirm(): void;

    /** Writes to the bound vault cell. */
    set(data: TWrite, extra?: TExtra): Promise<TResult>;

    /** Property-based action dispatcher bound to the selected cell. */
    readonly act: VaultActionDispatcher<TActions, TResult, TExtra>;

    /** Checks whether the cell has one of the expected statuses. */
    isStatus(statuses: VaultStatus | readonly VaultStatus[]): boolean;
}

/**
 * React binding for one vault cell.
 *
 * For remote vaults, reset and expiry keep the previous data as a temporary
 * fallback while the hook starts a fresh pull.
 */
export type UseVault = <
    TData = unknown,
    TWrite = TData,
    TResult = TData,
    TPathSegment = unknown,
    TExtra extends object = VaultExtra,
    TActions extends VaultActions<TPathSegment, TExtra> = VaultActions<TPathSegment, TExtra>,
    TInitReturn = unknown
>(
    vault: Vault<TData, TWrite, TResult, TPathSegment, TExtra, TActions, TInitReturn>,
    path?: readonly TPathSegment[],
    autoInit?: boolean
) => VaultHookPort<TData, TWrite, TResult, TExtra, TActions>;

export default createVault;
