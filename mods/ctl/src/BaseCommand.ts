import { Command, Interfaces } from "@oclif/core";

export type Args<T extends typeof Command> = Interfaces.InferredArgs<T["args"]>;

/**
 * Base class every `@qcobro/ctl` command extends. Provides shared flag
 * parsing (`baseFlags`, inherited by every command via `Flags<T>`) and a
 * single place to hook error handling, mirroring `@fonoster/ctl`'s
 * `BaseCommand`. QCobro's SDK talks tRPC over HTTPS with no insecure-channel
 * concept, so — unlike Fonoster's version — no `--insecure` flag is defined
 * here.
 */
export abstract class BaseCommand<T extends typeof Command> extends Command {
  static readonly baseFlags = {};

  protected flags!: Flags<T>;
  protected args!: Args<T>;

  public async init(): Promise<void> {
    await super.init();
    const { args, flags } = await this.parse({
      flags: this.ctor.flags,
      baseFlags: (super.ctor as typeof BaseCommand).baseFlags,
      enableJsonFlag: this.ctor.enableJsonFlag,
      args: this.ctor.args,
      strict: this.ctor.strict
    });
    this.flags = flags as Flags<T>;
    this.args = args as Args<T>;
  }

  protected async catch(err: Error & { exitCode?: number }): Promise<unknown> {
    return super.catch(err);
  }

  protected async finally(err: Error | undefined): Promise<unknown> {
    return super.finally(err);
  }
}

export type Flags<T extends typeof Command> = Interfaces.InferredFlags<
  (typeof BaseCommand)["baseFlags"] & T["flags"]
>;
