/**
 * Local headset audio bridge.
 *
 * Recording/playback is delegated to ffmpeg/ffplay (or arecord/aplay on Linux)
 * so the agent stays provider-agnostic and does not bundle native audio code.
 * Set BOW_AUDIO_INPUT_DEVICE/BOW_AUDIO_OUTPUT_DEVICE when the OS default is
 * not the headset.
 */
import { AudioDeviceConfig, Logger } from "@bow/shared";
import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import crypto from "crypto";

const execFileAsync = promisify(execFile);

export interface AudioControllerOptions extends AudioDeviceConfig {
    captureCommand?: string;
    playbackCommand?: string;
    tempDirectory?: string;
}

export class AudioController {
    private readonly logger: Logger;
    private readonly options: AudioControllerOptions;

    constructor(logger: Logger, options: AudioControllerOptions = {}) {
        this.logger = logger;
        this.options = options;
    }

    async listen(durationMs = 5000): Promise<Buffer> {
        const file = await this.tempFile("input", ".wav");
        const duration = Math.max(250, Math.round(durationMs)) / 1000;
        try {
            await this.runTemplate(this.captureTemplate(), { output: file, duration: String(duration) });
            return await fs.readFile(file);
        } finally { await this.remove(file); }
    }

    async play(audio: Buffer, extension = ".wav"): Promise<void> {
        const file = await this.tempFile("output", extension);
        try {
            await fs.writeFile(file, audio);
            await this.runTemplate(this.playbackTemplate(), { input: file });
        } finally { await this.remove(file); }
    }

    private captureTemplate(): string {
        if (this.options.captureCommand || process.env.BOW_AUDIO_CAPTURE_COMMAND) return this.options.captureCommand || process.env.BOW_AUDIO_CAPTURE_COMMAND!;
        const device = this.options.inputDevice || process.env.BOW_AUDIO_INPUT_DEVICE;
        if (process.platform === "win32") {
            if (!device) throw new Error("Set BOW_AUDIO_INPUT_DEVICE to the headset microphone name");
            return `ffmpeg -hide_banner -loglevel error -y -f dshow -i audio=\"${device}\" -t {duration} {output}`;
        }
        if (process.platform === "darwin") return `ffmpeg -hide_banner -loglevel error -y -f avfoundation -i \"${device || ":default"}\" -t {duration} {output}`;
        return `arecord -q -d {duration} -f cd {output}`;
    }

    private playbackTemplate(): string {
        if (this.options.playbackCommand || process.env.BOW_AUDIO_PLAYBACK_COMMAND) return this.options.playbackCommand || process.env.BOW_AUDIO_PLAYBACK_COMMAND!;
        const device = this.options.outputDevice || process.env.BOW_AUDIO_OUTPUT_DEVICE;
        if (process.platform === "win32") return device
            ? `ffplay -nodisp -autoexit -loglevel quiet -audio_device "${device}" {input}`
            : `ffplay -nodisp -autoexit -loglevel quiet {input}`;
        if (process.platform === "darwin") return `afplay {input}`;
        return device ? `aplay -q -D "${device}" {input}` : `aplay -q {input}`;
    }

    private async runTemplate(template: string, values: Record<string, string>): Promise<void> {
        const command = template.replace(/\{(output|input|duration)\}/g, (_, key: string) => this.quote(values[key]));
        const [file, ...args] = this.splitCommand(command);
        this.logger.debug("Running audio command", { command: file, args });
        await execFileAsync(file, args, { windowsHide: true, timeout: 120000 });
    }

    private splitCommand(command: string): string[] {
        const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        return parts.map((part) => part.replace(/^"|"$/g, ""));
    }

    private quote(value: string): string { return `"${value.replace(/"/g, "\\\"")}"`; }

    private async tempFile(prefix: string, extension: string): Promise<string> {
        const directory = this.options.tempDirectory || os.tmpdir();
        await fs.mkdir(directory, { recursive: true });
        return path.join(directory, `bow-${prefix}-${crypto.randomUUID()}${extension}`);
    }

    private async remove(file: string): Promise<void> { await fs.rm(file, { force: true }).catch(() => undefined); }
}

export default AudioController;
