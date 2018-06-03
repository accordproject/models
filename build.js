/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const ModelManager = require('composer-common').ModelManager;
const rimraf = require('rimraf');
    
const {
    promisify
} = require('util');
const {
    resolve
} = require('path');
const fs = require('fs-extra')
const readdir = promisify(fs.readdir);
const rename = promisify(fs.rename);
const stat = promisify(fs.stat);
const mkdirp = require('mkdirp');

async function getFiles(dir) {
    const subdirs = await readdir(dir);
    const files = await Promise.all(subdirs.map(async (subdir) => {
        const res = resolve(dir, subdir);
        return (await stat(res)).isDirectory() ? getFiles(res) : res;
    }));
    return files.reduce((a, f) => a.concat(f), []);
}

const rootDir = resolve(__dirname, './src/');

(async function () {

    // delete build directory
    rimraf.sync('./build');

    // copy the README.md
    await fs.ensureDir('./build');
    await fs.copy('./README.md', './build/README.md');

    // validate and copy all the files
    const files = await getFiles(rootDir);
    files.forEach(async (file) => {
        const modelText = fs.readFileSync(file, 'utf8');
        const mm = new ModelManager();
        try {
            if(process.env.VALIDATE) {
                mm.addModelFile(modelText, file, true);
                mm.updateExternalModels();
            }

            // passed validation, so copy to build dir
            const dest = file.replace('/src/', '/build/');
            const destPath = require('path').dirname(dest);
            await fs.ensureDir(destPath);
            await fs.copy(file, dest);
            console.log('Copied ' + file);
        } catch (err) {
            console.log(err.message);
        }
    });
})();