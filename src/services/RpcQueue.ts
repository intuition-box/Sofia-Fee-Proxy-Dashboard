/**
 * Pass-through fetch wrapper.
 *
 * Previously this was a rate-limiting queue for the public RPC.
 * Now that we use a private replica node, requests go straight through
 * with no concurrency limit or delay.
 *
 * The class is kept so the rest of the codebase doesn't need changes.
 */

export class RpcQueue {
  createFetchFn(): typeof fetch {
    return (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init)
  }

  get active(): number {
    return 0
  }

  get queued(): number {
    return 0
  }
}
