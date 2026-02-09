import { AsyncLocalStorage } from "node:async_hooks";
import pino from "pino";

interface RequestContext {
  conversationId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

const isProduction = process.env.NODE_ENV === "production";

const pinoOpts: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  mixin() {
    const ctx = requestContext.getStore();
    return ctx ? { conversationId: ctx.conversationId } : {};
  },
};

// pino-pretty's transport option uses worker threads which fail under Next.js bundler
// (thread-stream can't resolve the worker module path). Use it as a direct destination instead.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const prettyStream = !isProduction
  ? (
      require("pino-pretty") as (
        opts: Record<string, unknown>,
      ) => pino.DestinationStream
    )({ colorize: true })
  : undefined;

const logger = prettyStream ? pino(pinoOpts, prettyStream) : pino(pinoOpts);

export function createLogger(module: string) {
  return logger.child({ module });
}

export function withConversationId<T>(id: string, fn: () => T): T {
  return requestContext.run({ conversationId: id }, fn);
}

export default logger;
