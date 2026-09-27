import { networkInterfaces } from "node:os";

export interface Child {
  tag: string;
  proc: ReturnType<typeof Bun.spawn>;
}

async function prefixLines(stream: ReadableStream<Uint8Array>, tag: string, out: NodeJS.WriteStream): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl = buffer.indexOf("\n");
    while (nl >= 0) {
      out.write(`[${tag}] ${buffer.slice(0, nl)}\n`);
      buffer = buffer.slice(nl + 1);
      nl = buffer.indexOf("\n");
    }
  }
  if (buffer.trim()) out.write(`[${tag}] ${buffer}\n`);
}

/** Spawns a child process and prefixes every line it prints with [tag]. */
export function spawnTagged(tag: string, cmd: string[], opts: { cwd?: string; env?: Record<string, string | undefined> } = {}): Child {
  const proc = Bun.spawn(cmd, {
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  void prefixLines(proc.stdout, tag, process.stdout);
  void prefixLines(proc.stderr, tag, process.stderr);
  return { tag, proc };
}

export interface WaitOptions {
  timeoutMs?: number;
  /** Extra acceptance test on a 2xx response. */
  check?: (res: Response) => Promise<boolean> | boolean;
  /** Return true to stop waiting early (for example when the process being waited on has died). */
  abort?: () => boolean;
}

/** Polls a URL until it answers 2xx (and passes `check`), or throws on timeout/abort. */
export async function waitForHttp(url: string, opts: WaitOptions = {}): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (opts.abort?.()) throw new Error(`gave up waiting for ${url}: the process exited`);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (res.ok && (opts.check ? await opts.check(res.clone()) : true)) return res;
    } catch {
      /* not listening yet */
    }
    await Bun.sleep(400);
  }
  throw new Error(`timed out after ${Math.round(timeoutMs / 1000)}s waiting for ${url}`);
}

/** First non-internal IPv4 address, so the phone on the same wifi can be told where to go. */
export function lanIp(): string | null {
  for (const list of Object.values(networkInterfaces())) {
    for (const iface of list ?? []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return null;
}
