/********************************************************************************
 * Copyright (C) 2018-2020 Red Hat, Inc. and others.
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

import { join } from 'path';
import { homedir } from 'os';
import { injectable } from 'inversify';
import * as drivelist from 'drivelist';
import { EnvVariable, EnvVariablesServer } from '../../common/env-variables';
import { isWindows } from '../../common/os';
import { FileUri } from '../file-uri';

@injectable()
export class EnvVariablesServerImpl implements EnvVariablesServer {

    protected readonly envs: { [key: string]: EnvVariable } = {};
    protected readonly homeDirUri = FileUri.create(homedir()).toString();
    protected readonly configDirUri = FileUri.create(join(homedir(), '.theia')).toString();

    constructor() {
        const prEnv = process.env;
        Object.keys(prEnv).forEach((key: string) => {
            this.envs[key] = { 'name': key, 'value': prEnv[key] };
        });
    }

    async getExecPath(): Promise<string> {
        return process.execPath;
    }

    async getVariables(): Promise<EnvVariable[]> {
        return Object.keys(this.envs).map(key => this.envs[key]);
    }

    async getValue(key: string): Promise<EnvVariable | undefined> {
        if (isWindows) {
            key = key.toLowerCase();
        }
        return this.envs[key];
    }

    async getConfigDirUri(): Promise<string> {
        return this.configDirUri;
    }

    async getHomeDirUri(): Promise<string> {
        return this.homeDirUri;
    }

    getDrives(): Promise<string[]> {
        return new Promise<string[]>((resolve, reject) => {
            drivelist.list((error: Error, drives: { readonly mountpoints: { readonly path: string; }[] }[]) => {
                if (error) {
                    reject(error);
                    return;
                }

                const uris = drives
                    .map(drive => drive.mountpoints)
                    .reduce((prev, curr) => prev.concat(curr), [])
                    .map(mountpoint => mountpoint.path)
                    .filter(this.filterMountpointPath.bind(this))
                    .map(path => FileUri.create(path))
                    .map(uri => uri.toString());

                resolve(uris);
            });
        });
    }

    /**
     * Filters hidden and system partitions.
     */
    protected filterMountpointPath(path: string): boolean {
        // OS X: This is your sleep-image. When your Mac goes to sleep it writes the contents of its memory to the hard disk. (https://bit.ly/2R6cztl)
        if (path === '/private/var/vm') {
            return false;
        }
        // Ubuntu: This system partition is simply the boot partition created when the computers mother board runs UEFI rather than BIOS. (https://bit.ly/2N5duHr)
        if (path === '/boot/efi') {
            return false;
        }
        return true;
    }

}
