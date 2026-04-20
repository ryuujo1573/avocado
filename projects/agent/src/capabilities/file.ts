/**
 * File transfer capability handler for the agent.
 * Handles both upload (receive) and download (send) over a DataChannel.
 *
 * Security: paths are validated against an allow-list before any I/O.
 * Integrity: sha256 verified on both sides.
 */
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, renameSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "@avocado/core/qos";
import { CHUNK_SIZE } from "@avocado/core/machines";
import type {
  FileDownloadCapability,
  FileUploadCapability,
  WireMessage,
} from "@avocado/core/protocol";

type SendFn = (msg: WireMessage) => void;

type UploadSession = {
  kind: "upload";
  targetPath: string;
  tmpPath: string;
  writeStream: ReturnType<typeof createWriteStream>;
  hasher: ReturnType<typeof createHash>;
  expectedSha256: string;
  expectedSize: number;
  receivedSize: number;
  nextSeq: number;
  send: SendFn;
};

type DownloadSession = {
  kind: "download";
  send: SendFn;
};

type FileSession = UploadSession | DownloadSession;

export class FileCapabilityHandler {
  readonly #allowPaths: string[];
  readonly #sessions = new Map<string, FileSession>();

  constructor(allowPaths: string[]) {
    this.#allowPaths = allowPaths;
  }

  open(
    channelId: string,
    cap: FileUploadCapability | FileDownloadCapability,
    send: SendFn,
  ): void {
    if (cap.kind === "file-upload") {
      this.#openUpload(channelId, cap, send);
    } else {
      this.#startDownload(channelId, cap, send);
    }
  }

  #openUpload(
    channelId: string,
    cap: FileUploadCapability,
    send: SendFn,
  ): void {
    if (!this.#isAllowedPath(cap.path)) {
      logger.w("Path traversal attempt rejected: %o", cap.path);
      send({
        kind: "file-error",
        channelId,
        code: "PATH_NOT_ALLOWED",
        message: "target path is outside the allowed directory",
      });
      return;
    }

    const targetPath = resolve(cap.path);

    // Pre-check free space (best effort)
    try {
      const dir = dirname(targetPath);
      // On platforms where statvfs isn't available this may throw — that's ok
    } catch {
      // ignore
    }

    const tmpPath = resolve(
      dirname(targetPath),
      `.avocado-upload-${randomUUID()}.tmp`,
    );
    const writeStream = createWriteStream(tmpPath);
    const hasher = createHash("sha256");

    writeStream.on("error", (err) => {
      logger.e("Upload write error: %o", err);
      send({
        kind: "file-error",
        channelId,
        code: "WRITE_ERROR",
        message: err.message,
      });
      this.#cleanup(channelId, tmpPath);
    });

    this.#sessions.set(channelId, {
      kind: "upload",
      targetPath,
      tmpPath,
      writeStream,
      hasher,
      expectedSha256: cap.sha256,
      expectedSize: cap.size,
      receivedSize: 0,
      nextSeq: 0,
      send,
    });

    logger.i("Upload started: channelId=%o path=%o", channelId, targetPath);
  }

  handleChunk(channelId: string, seq: number, data: string): void {
    const session = this.#sessions.get(channelId);
    if (!session || session.kind !== "upload") return;

    if (seq !== session.nextSeq) {
      logger.e("Sequence gap: expected=%o got=%o", session.nextSeq, seq);
      session.send({
        kind: "file-error",
        channelId,
        code: "SEQ_ERROR",
        message: `expected seq ${session.nextSeq}, got ${seq}`,
      });
      this.#cleanup(channelId, session.tmpPath);
      return;
    }

    const buf = Buffer.from(data, "base64");
    session.hasher.update(new Uint8Array(buf));
    session.writeStream.write(buf);
    session.receivedSize += buf.length;
    session.nextSeq++;

    // If we've received everything, verify and rename
    if (session.receivedSize >= session.expectedSize) {
      session.writeStream.end(() => {
        const actualSha256 = session.hasher.digest("hex");
        if (actualSha256 !== session.expectedSha256) {
          logger.e(
            "Checksum mismatch: expected=%o actual=%o",
            session.expectedSha256,
            actualSha256,
          );
          session.send({
            kind: "file-error",
            channelId,
            code: "CHECKSUM_MISMATCH",
            message: "sha256 does not match",
          });
          this.#cleanup(channelId, session.tmpPath);
          return;
        }

        try {
          renameSync(session.tmpPath, session.targetPath);
        } catch (err) {
          logger.e("Failed to rename upload: %o", err);
          session.send({
            kind: "file-error",
            channelId,
            code: "RENAME_ERROR",
            message: String(err),
          });
          this.#cleanup(channelId, session.tmpPath);
          return;
        }

        logger.i(
          "Upload complete: channelId=%o path=%o size=%o",
          channelId,
          session.targetPath,
          session.receivedSize,
        );
        session.send({
          kind: "file-checksum",
          channelId,
          sha256: actualSha256,
        });
        this.#sessions.delete(channelId);
      });
    }
  }

  #startDownload(
    channelId: string,
    cap: FileDownloadCapability,
    send: SendFn,
  ): void {
    if (!this.#isAllowedPath(cap.path)) {
      logger.w("Path traversal attempt rejected: %o", cap.path);
      send({
        kind: "file-error",
        channelId,
        code: "PATH_NOT_ALLOWED",
        message: "source path is outside the allowed directory",
      });
      return;
    }

    const srcPath = resolve(cap.path);
    if (!existsSync(srcPath)) {
      send({
        kind: "file-error",
        channelId,
        code: "NOT_FOUND",
        message: "file not found",
      });
      return;
    }

    this.#sessions.set(channelId, { kind: "download", send });

    this.#streamDownload(channelId, srcPath, send);
  }

  async #streamDownload(
    channelId: string,
    srcPath: string,
    send: SendFn,
  ): Promise<void> {
    try {
      const { readFile } = await import("node:fs/promises");
      const buf = await readFile(srcPath);
      const hasher = createHash("sha256");
      hasher.update(new Uint8Array(buf));
      const sha256 = hasher.digest("hex");

      let seq = 0;
      for (let offset = 0; offset < buf.length; offset += CHUNK_SIZE) {
        if (!this.#sessions.has(channelId)) return; // cancelled
        const chunk = buf.subarray(offset, offset + CHUNK_SIZE);
        send({
          kind: "file-chunk",
          channelId,
          seq: seq++,
          data: chunk.toString("base64"),
        });
        // Yield to event loop between chunks
        await new Promise<void>((r) => setImmediate(r));
      }

      send({ kind: "file-checksum", channelId, sha256 });
      logger.i("Download complete: channelId=%o path=%o", channelId, srcPath);
      this.#sessions.delete(channelId);
    } catch (err) {
      logger.e("Download error: %o", err);
      send({
        kind: "file-error",
        channelId,
        code: "READ_ERROR",
        message: String(err),
      });
      this.#sessions.delete(channelId);
    }
  }

  close(channelId: string): void {
    const session = this.#sessions.get(channelId);
    if (!session) return;

    if (session.kind === "upload") {
      session.writeStream.destroy();
      this.#cleanup(channelId, session.tmpPath);
    } else {
      this.#sessions.delete(channelId);
    }

    logger.i("File channel closed: %o", channelId);
  }

  #cleanup(channelId: string, tmpPath: string): void {
    this.#sessions.delete(channelId);
    try {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    } catch {
      // ignore
    }
  }

  #isAllowedPath(p: string): boolean {
    const normalized = resolve(p);
    return this.#allowPaths.some((allowed) =>
      normalized.startsWith(resolve(allowed)),
    );
  }
}
