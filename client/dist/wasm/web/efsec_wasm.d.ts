/* tslint:disable */
/* eslint-disable */
export function main(): void;
/**
 * WebAssembly wrapper for `vodozemac` `Account`
 */
export class EfSecAccount {
  free(): void;
  /**
   * Create a new E2E account
   */
  constructor();
  /**
   * Generate one-time keys
   */
  generate_one_time_keys(count: number): void;
  /**
   * Get one-time keys as JSON
   */
  one_time_keys(): string;
  /**
   * Create outbound session with another user
   *
   * # Errors
   *
   * Returns `JsValue` error if key parsing fails
   */
  create_outbound_session(identity_key: string, one_time_key: string): EfSecSession;
  /**
   * Create inbound session from pre-key message
   *
   * # Errors
   *
   * Returns `JsValue` error if message parsing or session creation fails
   */
  create_inbound_session(message: string, identity_key: string): EfSecInboundResult;
  /**
   * Get account identity keys as JSON
   */
  readonly identity_keys: string;
}
/**
 * WebAssembly wrapper for `vodozemac` `InboundGroupSession`
 */
export class EfSecInboundGroupSession {
  free(): void;
  /**
   * Create inbound group session from session key
   *
   * # Errors
   *
   * Returns `JsValue` error if session key parsing fails
   */
  constructor(session_key: string);
  /**
   * Decrypt group message
   *
   * # Errors
   *
   * Returns `JsValue` error if decryption or string conversion fails
   */
  decrypt(ciphertext: string): string;
  /**
   * Get session ID
   */
  session_id(): string;
}
/**
 * Result type for inbound session creation
 */
export class EfSecInboundResult {
  private constructor();
  free(): void;
  readonly plaintext: string;
}
/**
 * WebAssembly wrapper for `vodozemac` `GroupSession` (group messaging)
 */
export class EfSecOutboundGroupSession {
  free(): void;
  /**
   * Create new outbound group session
   */
  constructor();
  /**
   * Encrypt group message
   */
  encrypt(plaintext: string): string;
  /**
   * Get session key for sharing with group members
   */
  session_key(): string;
  /**
   * Get session ID
   */
  session_id(): string;
}
/**
 * WebAssembly wrapper for vodozemac Session (1:1 messaging)
 */
export class EfSecSession {
  private constructor();
  free(): void;
  /**
   * Encrypt a message
   */
  encrypt(plaintext: string): string;
  /**
   * Decrypt a message
   *
   * # Errors
   *
   * Returns `JsValue` error if decryption or string conversion fails
   */
  decrypt(ciphertext: string): string;
  /**
   * Get session ID
   */
  session_id(): string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly main: () => void;
  readonly __wbg_efsecaccount_free: (a: number, b: number) => void;
  readonly efsecaccount_new: () => number;
  readonly efsecaccount_identity_keys: (a: number) => [number, number];
  readonly efsecaccount_generate_one_time_keys: (a: number, b: number) => void;
  readonly efsecaccount_one_time_keys: (a: number) => [number, number];
  readonly efsecaccount_create_outbound_session: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
  readonly efsecaccount_create_inbound_session: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
  readonly __wbg_efsecinboundresult_free: (a: number, b: number) => void;
  readonly efsecinboundresult_plaintext: (a: number) => [number, number];
  readonly __wbg_efsecsession_free: (a: number, b: number) => void;
  readonly efsecsession_encrypt: (a: number, b: number, c: number) => [number, number];
  readonly efsecsession_decrypt: (a: number, b: number, c: number) => [number, number, number, number];
  readonly efsecsession_session_id: (a: number) => [number, number];
  readonly __wbg_efsecoutboundgroupsession_free: (a: number, b: number) => void;
  readonly efsecoutboundgroupsession_new: () => number;
  readonly efsecoutboundgroupsession_encrypt: (a: number, b: number, c: number) => [number, number];
  readonly efsecoutboundgroupsession_session_key: (a: number) => [number, number];
  readonly efsecoutboundgroupsession_session_id: (a: number) => [number, number];
  readonly __wbg_efsecinboundgroupsession_free: (a: number, b: number) => void;
  readonly efsecinboundgroupsession_new: (a: number, b: number) => [number, number, number];
  readonly efsecinboundgroupsession_decrypt: (a: number, b: number, c: number) => [number, number, number, number];
  readonly efsecinboundgroupsession_session_id: (a: number) => [number, number];
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_4: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
