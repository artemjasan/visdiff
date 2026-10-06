interface VisdiffOptions {
    /** project root used for the task queue file (default: process.cwd()) */
    root?: string;
    /** first port for the standalone endpoint server (default: 9090) */
    port?: number;
    /** force the standalone server on; otherwise it starts only when NODE_ENV=development */
    enabled?: boolean;
}

export type { VisdiffOptions as V };
