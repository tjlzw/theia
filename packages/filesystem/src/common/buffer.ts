/********************************************************************************
 * Copyright (C) 2020 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as streams from './stream';
import * as strings from '@theia/core/lib/common/strings';

// TODO simplify with iconv

const hasBuffer = (typeof Buffer !== 'undefined');
const hasTextEncoder = (typeof TextEncoder !== 'undefined');
const hasTextDecoder = (typeof TextDecoder !== 'undefined');

let textEncoder: TextEncoder | null;
let textDecoder: TextDecoder | null;

export class TextBuffer {

    static alloc(byteLength: number): TextBuffer {
        if (hasBuffer) {
            return new TextBuffer(Buffer.allocUnsafe(byteLength));
        } else {
            return new TextBuffer(new Uint8Array(byteLength));
        }
    }

    static wrap(actual: Uint8Array): TextBuffer {
        if (hasBuffer && !(Buffer.isBuffer(actual))) {
            // https://nodejs.org/dist/latest-v10.x/docs/api/buffer.html#buffer_class_method_buffer_from_arraybuffer_byteoffset_length
            // Create a zero-copy Buffer wrapper around the ArrayBuffer pointed to by the Uint8Array
            actual = Buffer.from(actual.buffer, actual.byteOffset, actual.byteLength);
        }
        return new TextBuffer(actual);
    }

    static fromString(source: string): TextBuffer {
        if (hasBuffer) {
            return new TextBuffer(Buffer.from(source));
        } else if (hasTextEncoder) {
            if (!textEncoder) {
                textEncoder = new TextEncoder();
            }
            return new TextBuffer(textEncoder.encode(source));
        } else {
            return new TextBuffer(strings.encodeUTF8(source));
        }
    }

    static concat(buffers: TextBuffer[], totalLength?: number): TextBuffer {
        if (typeof totalLength === 'undefined') {
            totalLength = 0;
            for (let i = 0, len = buffers.length; i < len; i++) {
                totalLength += buffers[i].byteLength;
            }
        }

        const ret = TextBuffer.alloc(totalLength);
        let offset = 0;
        for (let i = 0, len = buffers.length; i < len; i++) {
            const element = buffers[i];
            ret.set(element, offset);
            offset += element.byteLength;
        }

        return ret;
    }

    readonly buffer: Uint8Array;
    readonly byteLength: number;

    private constructor(buffer: Uint8Array) {
        this.buffer = buffer;
        this.byteLength = this.buffer.byteLength;
    }

    toString(): string {
        if (hasBuffer) {
            return this.buffer.toString();
        } else if (hasTextDecoder) {
            if (!textDecoder) {
                textDecoder = new TextDecoder();
            }
            return textDecoder.decode(this.buffer);
        } else {
            return strings.decodeUTF8(this.buffer);
        }
    }

    slice(start?: number, end?: number): TextBuffer {
        // IMPORTANT: use subarray instead of slice because TypedArray#slice
        // creates shallow copy and NodeBuffer#slice doesn't. The use of subarray
        // ensures the same, performant, behaviour.
        return new TextBuffer(this.buffer.subarray(start, end));
    }

    set(array: TextBuffer, offset?: number): void;
    set(array: Uint8Array, offset?: number): void;
    set(array: TextBuffer | Uint8Array, offset?: number): void {
        if (array instanceof TextBuffer) {
            this.buffer.set(array.buffer, offset);
        } else {
            this.buffer.set(array, offset);
        }
    }

    readUInt32BE(offset: number): number {
        return (
            this.buffer[offset] * 2 ** 24
            + this.buffer[offset + 1] * 2 ** 16
            + this.buffer[offset + 2] * 2 ** 8
            + this.buffer[offset + 3]
        );
    }

    writeUInt32BE(value: number, offset: number): void {
        this.buffer[offset + 3] = value;
        value = value >>> 8;
        this.buffer[offset + 2] = value;
        value = value >>> 8;
        this.buffer[offset + 1] = value;
        value = value >>> 8;
        this.buffer[offset] = value;
    }

    readUInt32LE(offset: number): number {
        return (
            ((this.buffer[offset + 0] << 0) >>> 0) |
            ((this.buffer[offset + 1] << 8) >>> 0) |
            ((this.buffer[offset + 2] << 16) >>> 0) |
            ((this.buffer[offset + 3] << 24) >>> 0)
        );
    }

    writeUInt32LE(value: number, offset: number): void {
        this.buffer[offset + 0] = (value & 0b11111111);
        value = value >>> 8;
        this.buffer[offset + 1] = (value & 0b11111111);
        value = value >>> 8;
        this.buffer[offset + 2] = (value & 0b11111111);
        value = value >>> 8;
        this.buffer[offset + 3] = (value & 0b11111111);
    }

    readUInt8(offset: number): number {
        return this.buffer[offset];
    }

    writeUInt8(value: number, offset: number): void {
        this.buffer[offset] = value;
    }

}

export interface TextBufferReadable extends streams.Readable<TextBuffer> { }

export interface TextBufferReadableStream extends streams.ReadableStream<TextBuffer> { }

export interface TextBufferWriteableStream extends streams.WriteableStream<TextBuffer> { }

export function readableToBuffer(readable: TextBufferReadable): TextBuffer {
    return streams.consumeReadable<TextBuffer>(readable, chunks => TextBuffer.concat(chunks));
}

export function bufferToReadable(buffer: TextBuffer): TextBufferReadable {
    return streams.toReadable<TextBuffer>(buffer);
}

export function streamToBuffer(stream: streams.ReadableStream<TextBuffer>): Promise<TextBuffer> {
    return streams.consumeStream<TextBuffer>(stream, chunks => TextBuffer.concat(chunks));
}
export function bufferToStream(buffer: TextBuffer): streams.ReadableStream<TextBuffer> {
    return streams.toStream<TextBuffer>(buffer, chunks => TextBuffer.concat(chunks));
}

export function newWriteableBufferStream(): streams.WriteableStream<TextBuffer> {
    return streams.newWriteableStream<TextBuffer>(chunks => TextBuffer.concat(chunks));
}
