import CreateRimeWasm from "./rime_emscripten"
import { getFs } from "../utils"
import { Mutex } from 'async-mutex';
import { openDB, deleteDB, unwrap } from "idb";
import type { RimeCommit, RimeContext, RimeSchema, RimeStatus } from "~shared-types";
import type { Schema } from "yaml";
import type { FastIndexedDbFsController } from "~fs";

export class RimeSession {
    engine: RimeEngine;
    wasmSession: any;

    constructor(session: any, engine: RimeEngine) {
        this.wasmSession = session;
        this.engine = engine;
    }

    async processKey(keyId: number, mask: number): Promise<boolean> {
        return await this.engine.mutex.runExclusive(async () => {
            return await this.wasmSession.processKey(keyId, mask);
        });
    }

    async getContext(): Promise<RimeContext> {
        return await this.engine.mutex.runExclusive(async () => {
            return await this.wasmSession.getContext();
        });
    }

    async getCommit(): Promise<RimeCommit> {
        return await this.engine.mutex.runExclusive(async () => {
            return await this.wasmSession.getCommit();
        });
    }

    async getStatus(): Promise<RimeStatus> {
        return await this.engine.mutex.runExclusive(async () => {
            return await this.wasmSession.getStatus();
        });
    }

    async clearComposition(): Promise<void> {
        await this.engine.mutex.runExclusive(async () => {
            await this.wasmSession.clearComposition();
        });
    }

    async getCurrentSchema(): Promise<string> {
        return await this.engine.mutex.runExclusive(async () => {
            const s = await this.wasmSession.getCurrentSchema();
            if (s == null)
                throw new Error("Cannot get current schema");
            return s;
        });
    }

    async actionCandidateOnCurrentPage(index: number, op: 'select' | 'delete'): Promise<void> {
        await this.engine.mutex.runExclusive(async () => {
            let action: number;
            if (op == 'select') {
                action = 0;
            } else if (op == 'delete') {
                action = 1;
            }
            const s = await this.wasmSession.actionCandidateOnCurrentPage(index, action);
            if (!s)
                throw new Error(`Cannot ${op} candidate ${index}`);
        });
    }

    destroy() {
        this.wasmSession.delete();
    }
}

export class RimeEngine {
    wasmObject: any;
    mutex: Mutex;
    initialized: boolean;
    constructor() {
        this.mutex = new Mutex();
        this.initialized = false;
    }

    async initialize(printErr: (string) => void, fs: FastIndexedDbFsController) {
        await this.mutex.runExclusive(async () => {
            if (!this.initialized) {
                this.wasmObject = await CreateRimeWasm({
                    locateFile: (path, dir) => {
                        return '/assets/' + path;
                    },
                    fsc: fs,
                    idb: { openDB, deleteDB },
                    printErr,
                })
                await this.wasmObject.rimeSetup();
                this.initialized = true;
            }
        })
    }

    async rebuildPrism(schemaId: string, schemaConfig: string): Promise<void> {
        await this.mutex.runExclusive(async () => {
            await this.wasmObject.rimeRebuildPrismForSchema(schemaId, schemaConfig);
        });
    }

    async createSession(schemaId: string, schemaConfig: string): Promise<RimeSession> {
        return await this.mutex.runExclusive(async () => {
            console.log("Creating session")
            const newSession = new this.wasmObject.RimeSession();
            console.log("Initializing session");
            await newSession.initialize(schemaId, schemaConfig);
            return new RimeSession(newSession, this);
        });
    }

    async performMaintenance(): Promise<void> {
        return await this.mutex.runExclusive(async () => {
            await this.wasmObject.rimePerformMaintenance(true);
        });
    }

    async destroy() {
        this.wasmObject?.rimeFinalize();
        this.wasmObject = null;
    }

    async getSchemaList(): Promise<RimeSchema[]> {
        return await this.mutex.runExclusive(async () => {
            const l = await this.wasmObject.rimeGetSchemaList();
            if (l != null)
                return l;
            throw Error("Cannot get schema list");
        });
    }
}
